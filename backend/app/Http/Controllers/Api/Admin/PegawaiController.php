<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\PegawaiTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PegawaiPotongRequest;
use App\Http\Requests\Admin\PegawaiStoreRequest;
use App\Http\Requests\Admin\PegawaiUpdateRequest;
use App\Models\ImportSesi;
use App\Models\KeaktifanPegawai;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Services\PegawaiImporService;
use App\Services\UrutKatalog;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Buku Induk Guru (`pegawai`): CRUD identitas + import bertahap +
 * tautan akun + daftar opsi aktif (dropdown walas).
 * Penempatan (`lembaga_pegawai`) & riwayat TA (`keaktifan_pegawai`):
 * controller terpisah di bawah.
 */
class PegawaiController extends Controller
{
    use ImporBertahap;
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE = ['pegawai.nip', 'pegawai.nik', 'pegawai.tgl_mulai_kerja', 'pegawai.tgl_sk_awal'];

    /** GET /api/admin/pegawai — daftar buku induk (global; filter lembaga/TA via penempatan/keaktifan). */
    public function index(Request $request): JsonResponse
    {
        $urut = $this->parseUrut($request, UrutKatalog::peta('pegawai'));
        $query = Pegawai::with(['penempatan.lembaga:jenjang,nama', 'akun:id,name,email']);

        $lembaga = $this->nilaiFilter($request, 'jenjang');
        $this->authorizeLembagaMany($request->user(), $lembaga);
        if ($lembaga !== []) {
            $query->whereHas('penempatan', fn ($p) => $p->whereIn('jenjang', $lembaga));
        }
        $tahunAjaran = $this->nilaiFilter($request, 'tahun_ajaran');
        if ($tahunAjaran !== []) {
            $query->whereHas('keaktifan', fn ($k) => $k->whereIn('tahun_ajaran', $tahunAjaran));
        }
        if ($request->filled('status_aktif')) {
            $query->where('pegawai.status_aktif', $request->input('status_aktif'));
        }
        if ($request->filled('q')) {
            $q = trim((string) $request->input('q'));
            $query->where(fn ($sub) => $sub
                ->where('nama_lengkap', 'like', "%{$q}%")
                ->orWhere('nip', 'like', "%{$q}%")
                ->orWhere('nik', 'like', "%{$q}%")
                ->orWhere('no_sk_awal', 'like', "%{$q}%"));
        }

        $this->terapkanUrut($query, $urut, [
            ['pegawai.nama_lengkap', 'naik'], ['pegawai.id', 'naik'],
        ], self::SORT_NULLABLE);

        return response()->json($query->paginate($this->perPage($request)));
    }

    public function store(PegawaiStoreRequest $request): JsonResponse
    {
        try {
            $pegawai = Pegawai::create($request->validated());
        } catch (QueryException $e) {
            return response()->json(['message' => 'NIP/NIK sudah dipakai pegawai lain.'], 422);
        }

        return response()->json(['pesan' => 'Pegawai disimpan.', 'data' => $pegawai], 201);
    }

    public function update(PegawaiUpdateRequest $request, Pegawai $pegawai): JsonResponse
    {
        try {
            $pegawai->update($request->validated());
        } catch (QueryException $e) {
            return response()->json(['message' => 'NIP/NIK sudah dipakai pegawai lain.'], 422);
        }

        return response()->json(['pesan' => 'Pegawai diperbarui.', 'data' => $pegawai->fresh()]);
    }

    public function destroy(Pegawai $pegawai): JsonResponse
    {
        $pegawai->delete();

        return response()->json(['pesan' => 'Pegawai dihapus.']);
    }

    /** POST /api/admin/pegawai/{pegawai}/tautkan-akun — tautkan/lepas akun login. */
    public function tautkanAkun(Request $request, Pegawai $pegawai): JsonResponse
    {
        $data = $request->validate(['user_id' => ['nullable', 'integer', 'exists:users,id']]);
        $pegawai->update(['user_id' => $data['user_id'] ?? null]);

        return response()->json(['pesan' => 'Akun ditautkan.', 'data' => $pegawai->fresh()]);
    }

    /** GET /api/admin/pegawai/aktif — opsi dropdown wali: pegawai aktif di lembaga + TA. */
    public function aktif(Request $request): JsonResponse
    {
        $data = $request->validate([
            'jenjang' => ['required', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ]);
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $rows = Pegawai::where('pegawai.status_aktif', Pegawai::AKTIF)
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('lembaga_pegawai')
                ->whereColumn('lembaga_pegawai.pegawai_id', 'pegawai.id')
                ->where('lembaga_pegawai.jenjang', $data['jenjang'])
                ->where('lembaga_pegawai.is_active_lembaga', LembagaPegawai::YA))
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('keaktifan_pegawai')
                ->whereColumn('keaktifan_pegawai.pegawai_id', 'pegawai.id')
                ->where('keaktifan_pegawai.jenjang', $data['jenjang'])
                ->where('keaktifan_pegawai.tahun_ajaran', $data['tahun_ajaran'])
                ->where('keaktifan_pegawai.status_keaktifan', KeaktifanPegawai::AKTIF))
            ->orderBy('pegawai.nama_lengkap')
            ->get(['id', 'nip', 'nama_lengkap']);

        return response()->json($rows);
    }

    /** GET /api/admin/pegawai/import-template — template Excel buku induk. */
    public function templateImport()
    {
        return Excel::download(new PegawaiTemplateExport, 'template-import-pegawai.xlsx');
    }

    /** GET /api/admin/pegawai/data-existing — JSON kolom template + baris nyata (Excel dirakit di browser). */
    public function dataExisting(): JsonResponse
    {
        $kolom = PegawaiTemplateExport::kolom();
        $baris = Pegawai::orderBy('nama_lengkap')->limit(5000)->get()
            ->map(fn (Pegawai $p) => [
                'pegawai_id' => $p->id,
                'nama_lengkap' => $p->nama_lengkap,
                'nip' => $p->nip,
                'nik' => $p->nik,
                'jenis_kelamin' => $p->jenis_kelamin,
                'gelar_depan' => $p->gelar_depan,
                'gelar_belakang' => $p->gelar_belakang,
                'tempat_lahir' => $p->tempat_lahir,
                'tanggal_lahir' => $p->tanggal_lahir?->format('Y-m-d'),
                'no_hp' => $p->no_hp,
                'email_pribadi' => $p->email_pribadi,
                'email_gws' => $p->email_gws,
                'status_aktif' => $p->status_aktif,
                'tgl_mulai_kerja' => $p->tgl_mulai_kerja?->format('Y-m-d'),
                'no_sk_awal' => $p->no_sk_awal,
                'tgl_sk_awal' => $p->tgl_sk_awal?->format('Y-m-d'),
                'pendidikan_terakhir' => $p->pendidikan_terakhir,
                'jenis_ptk' => $p->jenis_ptk,
                'status_pernikahan' => $p->status_pernikahan,
                'agama' => $p->agama,
                'gol_darah' => $p->gol_darah,
            ])->all();

        return response()->json([
            'kolom' => $kolom,
            'wajib' => PegawaiTemplateExport::kolomWajib(),
            'baris' => $baris,
        ]);
    }

    /** POST /api/admin/pegawai/import-potong — import bertahap 1000 baris/panggilan. */
    public function potongImport(PegawaiPotongRequest $request, PegawaiImporService $layanan): JsonResponse
    {
        return $this->jalankanImporSesi($request, 'pegawai', $layanan);
    }

    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-pegawai.csv');
    }
}
