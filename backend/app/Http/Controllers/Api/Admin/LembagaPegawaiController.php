<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\PenempatanPegawaiTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LembagaPegawaiStoreRequest;
use App\Http\Requests\Admin\LembagaPegawaiUpdateRequest;
use App\Http\Requests\Admin\PenempatanPegawaiPotongRequest;
use App\Models\ImportSesi;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Services\AkunPegawaiService;
use App\Services\Impor\DataPenempatanPegawai;
use App\Services\PegawaiService;
use App\Services\PenempatanPegawaiImporService;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Penempatan pegawai per lembaga (`lembaga_pegawai`) — pivot kaya:
 * tugas, status, rentang tanggal. NIPP tinggal di `pegawai` (unik global).
 * 1 baris per (pegawai, lembaga); masuk-lagi = aktifkan ulang.
 */
class LembagaPegawaiController extends Controller
{
    use ImporBertahap;
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE = [
        'lembaga_pegawai.tgl_masuk', 'lembaga_pegawai.tgl_selesai',
        'lembaga_pegawai.tgl_sk_awal_ptk',
    ];

    /** GET /api/admin/pegawai-lembaga — daftar penempatan lintas pegawai. */
    public function index(Request $request): JsonResponse
    {
        $urut = $this->parseUrut($request, UrutKatalog::peta('pegawai_lembaga'));

        $query = $this->scopeLembaga(
            LembagaPegawai::with(['pegawai:id,nama_lengkap,nip,nipp,jenis_kelamin,status_aktif', 'lembaga:jenjang,nama']),
            $request->user(),
            $request,
            'lembaga_pegawai.jenjang'
        );

        if ($request->has('is_active_lembaga')) {
            $query->where('lembaga_pegawai.is_active_lembaga', $request->boolean('is_active_lembaga') ? LembagaPegawai::YA : LembagaPegawai::TIDAK);
        }
        if ($request->filled('q')) {
            $q = trim((string) $request->input('q'));
            $query->where(fn ($sub) => $sub
                ->whereHas('pegawai', fn ($p) => $p
                    ->where('nama_lengkap', 'like', "%{$q}%")
                    ->orWhere('nip', 'like', "%{$q}%")
                    ->orWhere('nipp', 'like', "%{$q}%"))
                ->orWhere('lembaga_pegawai.no_sk_awal_ptk', 'like', "%{$q}%"));
        }

        $query->select('lembaga_pegawai.*')
            ->leftJoin('pegawai', 'pegawai.id', '=', 'lembaga_pegawai.pegawai_id');
        $this->terapkanUrut($query, $urut, [
            ['lembaga_pegawai.is_active_lembaga', 'turun'], ['pegawai.nama_lengkap', 'naik'],
        ], self::SORT_NULLABLE);

        return response()->json($query->paginate($this->perPage($request)));
    }

    /** GET /api/admin/pegawai/{pegawai}/penempatan — daftar penempatan satu guru. */
    public function untuk(Request $request, Pegawai $pegawai): JsonResponse
    {
        return response()->json([
            'pesan' => 'Penempatan berhasil dimuat.',
            'data' => $pegawai->penempatan()->with('lembaga:jenjang,nama')
                ->orderByDesc('is_active_lembaga')->orderBy('id')->get(),
        ]);
    }

    /** POST /api/admin/pegawai/{pegawai}/tempatkan — buat/aktifkan penempatan (aksi →). */
    public function tempatkan(LembagaPegawaiStoreRequest $request, Pegawai $pegawai, PegawaiService $layanan, AkunPegawaiService $akun): JsonResponse
    {
        $data = $request->validated();
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        // Taut otomatis dulu (bila email dipakai akun yang memenuhi syarat)
        // agar penempatan di bawah sekaligus menulis relasi user_lembaga.
        $akun->cobaTautkan($pegawai, $request->user());
        $row = $layanan->pastikanPenempatan($pegawai, $data['jenjang'], $data);

        return response()->json(['pesan' => 'Pegawai ditempatkan di lembaga.', 'data' => $row], 201);
    }

    /** PATCH /api/admin/pegawai-lembaga/{penempatan} — tugas/tanggal/SK PTK. */
    public function update(LembagaPegawaiUpdateRequest $request, LembagaPegawai $penempatan, PegawaiService $layanan): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $penempatan->jenjang);
        $data = $request->validated();
        if (array_key_exists('jenjang', $data) && $data['jenjang'] !== $penempatan->jenjang) {
            abort(422, 'Lembaga penempatan tidak dapat dipindah; buat penempatan baru.');
        }

        $row = $layanan->pastikanPenempatan($penempatan->pegawai, $penempatan->jenjang, $data);

        return response()->json(['pesan' => 'Penempatan diperbarui.', 'data' => $row->fresh()]);
    }

    /** POST /api/admin/pegawai-lembaga/{penempatan}/nonaktifkan — tutup + bekukan keaktifan berjalan. */
    public function nonaktifkan(Request $request, LembagaPegawai $penempatan, PegawaiService $layanan): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $penempatan->jenjang);
        $data = $request->validate(['tgl_selesai' => ['nullable', 'date']]);

        return response()->json([
            'pesan' => 'Penempatan dinonaktifkan.',
            'data' => $layanan->nonaktifkanPenempatan($penempatan, $data['tgl_selesai'] ?? null),
        ]);
    }

    /** POST /api/admin/pegawai-lembaga/{penempatan}/aktifkan — buka lagi penempatan arsip. */
    public function aktifkan(Request $request, LembagaPegawai $penempatan, PegawaiService $layanan): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $penempatan->jenjang);

        return response()->json([
            'pesan' => 'Penempatan diaktifkan.',
            'data' => $layanan->aktifkanPenempatan($penempatan),
        ]);
    }

    /** DELETE /api/admin/pegawai-lembaga/{penempatan} — hapus permanen + keaktifan terkait + akses akun. */
    public function destroy(Request $request, LembagaPegawai $penempatan, PegawaiService $layanan): JsonResponse
    {
        $this->authorizeLembaga($request->user(), $penempatan->jenjang);

        $layanan->hapusPenempatan($penempatan);

        return response()->json(['pesan' => 'Penempatan dihapus.']);
    }

    // ---------------- Import penempatan (potongan JSON bertahap) ----------------

    /** GET /api/admin/pegawai-lembaga/import-template — template Excel. */
    public function templateImport()
    {
        return Excel::download(new PenempatanPegawaiTemplateExport, 'template-import-penempatan-pegawai.xlsx');
    }

    /**
     * GET /api/admin/pegawai-lembaga/data-existing — data penempatan existing
     * sebagai JSON (kolom = template import). Berkas Excel disusun di browser.
     */
    public function dataExisting(Request $request): JsonResponse
    {
        $data = new DataPenempatanPegawai($this->jenjangUntukBerkas($request));

        return response()->json([
            'kolom' => $data->kolom(),
            'wajib' => $data->wajib(),
            'baris' => $data->baris(),
        ]);
    }

    /**
     * POST /api/admin/pegawai-lembaga/import-potong — satu potongan baris
     * (maks 1000) dari browser. Panggilan pertama tanpa `sesi_id` membuat
     * sesi (wajib `mode` + `total`); berikutnya wajib `sesi_id` milik sendiri.
     * Frontend mengirim SEMUA baris data berurutan (termasuk yang kosong)
     * agar nomor galat absolut selaras nomor Excel (1 = heading).
     */
    public function potongImport(PenempatanPegawaiPotongRequest $request, PenempatanPegawaiImporService $layanan): JsonResponse
    {
        return $this->jalankanImporSesi($request, 'penempatan_pegawai', $layanan);
    }

    /** POST /api/admin/pegawai-lembaga/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/pegawai-lembaga/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-penempatan.csv');
    }
}
