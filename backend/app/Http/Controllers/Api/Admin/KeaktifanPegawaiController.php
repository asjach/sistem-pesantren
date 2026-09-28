<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\KeaktifanTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\KeaktifanPegawaiStoreRequest;
use App\Http\Requests\Admin\KeaktifanPotongRequest;
use App\Models\ImportSesi;
use App\Models\KeaktifanPegawai;
use App\Models\LembagaPegawai;
use App\Services\Impor\DataKeaktifan;
use App\Services\KeaktifanImporService;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Riwayat keaktifan guru per lembaga + TA (`keaktifan_pegawai`,
 * konsep `riwayat_keaktifan_pegawai`): daftar aktif + aktif/nonaktif.
 * Tulis hanya bila penempatan (`lembaga_pegawai`) ada.
 */
class KeaktifanPegawaiController extends Controller
{
    use ImporBertahap;
    use TenantGuard;
    use UrutDaftar;

    /** GET /api/admin/pegawai-keaktifan — wajib 1 TA (filter global), opsional lembaga. */
    public function index(Request $request): JsonResponse
    {
        $urut = $this->parseUrut($request, UrutKatalog::peta('pegawai_keaktifan'));

        $query = $this->scopeLembaga(
            KeaktifanPegawai::with([
                'pegawai:id,nama_lengkap,nip,jenis_kelamin,status_aktif',
                'lembaga:jenjang,nama',
            ]),
            $request->user(),
            $request,
            'keaktifan_pegawai.jenjang'
        );

        $this->applyFilter($query, $request, 'tahun_ajaran', 'keaktifan_pegawai.tahun_ajaran');
        if ($request->filled('status_keaktifan')) {
            $query->where('keaktifan_pegawai.status_keaktifan', $request->input('status_keaktifan'));
        }
        $query->select('keaktifan_pegawai.*')
            ->leftJoin('pegawai', 'pegawai.id', '=', 'keaktifan_pegawai.pegawai_id');
        if ($request->filled('q')) {
            $q = trim((string) $request->input('q'));
            $query->where(fn ($sub) => $sub
                ->where('pegawai.nama_lengkap', 'like', "%{$q}%")
                ->orWhere('pegawai.nip', 'like', "%{$q}%")
                ->orWhere('pegawai.nipp', 'like', "%{$q}%")
                ->orWhere('keaktifan_pegawai.no_sk', 'like', "%{$q}%"));
        }
        $this->terapkanUrut($query, $urut, [
            ['pegawai.nama_lengkap', 'naik'], ['keaktifan_pegawai.id', 'naik'],
        ]);

        $hasil = $query->paginate($this->perPage($request));

        return response()->json($hasil);
    }

    /** POST /api/admin/pegawai-keaktifan — aktifkan penempatan untuk satu TA. */
    public function store(KeaktifanPegawaiStoreRequest $request): JsonResponse
    {
        $data = $request->validated();
        $this->authorizeLembaga($request->user(), $data['jenjang']);
        $this->cekTaEfektif($data['jenjang'], $data['tahun_ajaran']);

        $penempatan = LembagaPegawai::untuk((int) $data['pegawai_id'], $data['jenjang']);
        if (! $penempatan) {
            throw ValidationException::withMessages(['pegawai_id' => 'Pegawai belum ditempatkan di lembaga ini (aksi → dulu).']);
        }

        $row = DB::transaction(function () use ($data, $penempatan) {
            $ada = KeaktifanPegawai::where('pegawai_id', $data['pegawai_id'])
                ->where('jenjang', $data['jenjang'])
                ->where('tahun_ajaran', $data['tahun_ajaran'])
                ->first();
            $nilai = [
                'tugas_utama' => $data['tugas_utama'] ?? $penempatan->tugas_utama,
                'status_keaktifan' => $data['status_keaktifan'] ?? KeaktifanPegawai::AKTIF,
            ];
            foreach (['no_sk', 'tgl_sk'] as $kolomSk) {
                if (array_key_exists($kolomSk, $data)) {
                    $nilai[$kolomSk] = $data[$kolomSk];
                }
            }
            if ($ada) {
                $ada->update($nilai);

                return $ada->fresh();
            }

            return KeaktifanPegawai::create($nilai + [
                'pegawai_id' => $data['pegawai_id'],
                'jenjang' => $data['jenjang'],
                'tahun_ajaran' => $data['tahun_ajaran'],
            ]);
        });

        return response()->json(['pesan' => 'Keaktifan disimpan.', 'data' => $row], 201);
    }

    /** POST /api/admin/pegawai-keaktifan/aktifkan-massal — aktifkan penempatan aktif untuk TA. */
    public function aktifkanMassal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'pegawai_id' => ['sometimes', 'array'],
            'pegawai_id.*' => ['integer', 'exists:pegawai,id'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);
        $this->cekTaEfektif($data['jenjang'], $data['tahun_ajaran']);

        $q = LembagaPegawai::where('jenjang', $data['jenjang'])
            ->where('is_active_lembaga', LembagaPegawai::YA);
        if (! empty($data['pegawai_id'])) {
            $q->whereIn('pegawai_id', $data['pegawai_id']);
        }

        $dibuat = 0;
        $q->chunkById(200, function ($rows) use ($data, &$dibuat) {
            foreach ($rows as $tempat) {
                KeaktifanPegawai::updateOrCreate(
                    ['pegawai_id' => $tempat->pegawai_id, 'jenjang' => $data['jenjang'], 'tahun_ajaran' => $data['tahun_ajaran']],
                    ['tugas_utama' => $tempat->tugas_utama, 'status_keaktifan' => KeaktifanPegawai::AKTIF]
                );
                $dibuat++;
            }
        });

        return response()->json(['pesan' => "{$dibuat} guru diaktifkan.", 'data' => ['dibuat' => $dibuat]]);
    }

    /** POST /api/admin/pegawai-keaktifan/{keaktifan}/nonaktifkan. */
    public function nonaktifkan(Request $request, KeaktifanPegawai $keaktifan): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $keaktifan->jenjang);
        $keaktifan->update(['status_keaktifan' => KeaktifanPegawai::INAKTIF]);

        return response()->json(['pesan' => 'Keaktifan dinonaktifkan.', 'data' => $keaktifan->fresh()]);
    }

    /** DELETE /api/admin/pegawai-keaktifan/{keaktifan} — hapus permanen baris riwayat. */
    public function destroy(Request $request, KeaktifanPegawai $keaktifan): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $keaktifan->jenjang);
        $keaktifan->delete();

        return response()->json(['pesan' => 'Keaktifan dihapus.']);
    }

    // ---------------- Import riwayat keaktifan (potongan JSON bertahap) ----------------

    /** GET /api/admin/pegawai-keaktifan/import-template — template Excel. */
    public function templateImport()
    {
        return Excel::download(new KeaktifanTemplateExport, 'template-import-keaktifan-pegawai.xlsx');
    }

    /**
     * GET /api/admin/pegawai-keaktifan/data-existing — data keaktifan existing
     * sebagai JSON (kolom = template import; status = label). Berkas Excel
     * disusun di browser.
     */
    public function dataExisting(Request $request): JsonResponse
    {
        $data = new DataKeaktifan($this->jenjangUntukBerkas($request));

        return response()->json([
            'kolom' => $data->kolom(),
            'wajib' => $data->wajib(),
            'baris' => $data->baris(),
        ]);
    }

    /**
     * POST /api/admin/pegawai-keaktifan/import-potong — satu potongan baris
     * (maks 1000) dari browser. Panggilan pertama tanpa `sesi_id` membuat
     * sesi (wajib `mode` + `total`); berikutnya wajib `sesi_id` milik sendiri.
     * Frontend mengirim SEMUA baris data berurutan (termasuk yang kosong)
     * agar nomor galat absolut selaras nomor Excel (1 = heading).
     */
    public function potongImport(KeaktifanPotongRequest $request, KeaktifanImporService $layanan): JsonResponse
    {
        return $this->jalankanImporSesi($request, 'keaktifan_pegawai', $layanan);
    }

    /** POST /api/admin/pegawai-keaktifan/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/pegawai-keaktifan/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-keaktifan.csv');
    }
}
