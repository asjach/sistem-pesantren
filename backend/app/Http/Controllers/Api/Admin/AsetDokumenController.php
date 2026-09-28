<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\PerPageLimit;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AsetDokumenRequest;
use App\Models\AsetDokumen;
use App\Models\TemplateDokumen;
use App\Services\Template\AsetGambar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

/**
 * Pustaka aset cetak: stempel dan tanda tangan yang diunggah pengguna. Logo
 * lembaga serta foto Santri dan pegawai tidak ada di sini karena sudah punya
 * kolomnya masing-masing.
 */
class AsetDokumenController extends Controller
{
    use PerPageLimit;
    use TenantGuard;
    use UrutDaftar;

    public function __construct(private readonly AsetGambar $aset) {}

    public function index(Request $request): JsonResponse
    {
        $urut = $this->parseUrut($request, [
            'nama' => ['nama'],
            'dibuat' => ['created_at'],
            'ukuran' => ['ukuran_byte'],
        ]);

        $daftar = AsetDokumen::tersedia($this->jenjangUntukBerkas($request))->cari($request->input('q'));
        $this->terapkanUrut($daftar, $urut, [['nama', 'naik']], ['jenjang']);

        $total = (clone $daftar)->count();
        $halaman = max(1, (int) $request->input('page', 1));
        $perPage = $this->perPage($request);

        $data = $daftar->forPage($halaman, $perPage)->get()
            ->map(fn (AsetDokumen $a) => $this->ringkas($a))
            ->all();

        return response()->json([
            'pesan' => 'Daftar aset berhasil dimuat.',
            'data' => $data,
            'meta' => [
                'total' => $total,
                'page' => $halaman,
                'per_page' => $perPage,
                'last_page' => (int) max(1, ceil($total / max(1, $perPage))),
            ],
        ]);
    }

    public function store(AsetDokumenRequest $request): JsonResponse
    {
        $jenjang = trim((string) $request->input('jenjang', ''));

        if ($jenjang !== '') {
            $this->authorizeLembaga($request->user(), $jenjang);
        }

        $aset = $this->aset->simpanGambar($request->file('berkas'), $jenjang === '' ? null : $jenjang, $request->user()->id);
        $aset->nama = $request->string('nama')->toString();
        $aset->save();

        return response()->json([
            'pesan' => 'Aset berhasil diunggah.',
            'data' => $this->ringkas($aset),
        ], 201);
    }

    public function destroy(Request $request, AsetDokumen $aset): JsonResponse
    {
        if ($aset->jenjang !== null) {
            $this->authorizeLembaga($request->user(), $aset->jenjang);
        }

        $dipakai = $this->pemakaian($aset->id);

        if ($dipakai > 0) {
            return response()->json([
                'pesan' => "Aset masih dipakai oleh {$dipakai} medan pada template. Hapus medannya lebih dulu.",
            ], 422);
        }

        $this->aset->hapusAset($aset);

        return response()->json(['pesan' => 'Aset berhasil dihapus.']);
    }

    /** Berkas aset untuk ditampilkan di panel pustaka. */
    public function berkas(Request $request, AsetDokumen $aset): Response
    {
        if ($aset->jenjang !== null) {
            $this->authorizeLembaga($request->user(), $aset->jenjang);
        }

        $penuh = Storage::disk(AsetGambar::DISK)->path($aset->path);

        abort_unless(is_file($penuh), 404, 'Berkas aset tidak ditemukan.');

        return response()->file($penuh, [
            'Content-Type' => $aset->mime,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    /**
     * Berapa medan yang menunjuk aset ini. Aset yang masih terpakai tidak
     * boleh dihapus, karena medannya akan menggantung dan dokumen tercetak jadi
     * kehilangan bagian.
     */
    private function pemakaian(int $asetId): int
    {
        $jumlah = 0;
        $target = ['aset:'.$asetId, (string) $asetId];

        foreach (TemplateDokumen::query()->whereNotNull('definisi')->get(['definisi']) as $template) {
            foreach ($template->definisi['medan'] ?? [] as $medan) {
                if (($medan['tipe'] ?? '') !== 'gambar' || ($medan['sumber'] ?? '') !== 'aset') {
                    continue;
                }

                if (in_array((string) ($medan['kunci'] ?? ''), $target, true)) {
                    $jumlah++;
                }
            }
        }

        return $jumlah;
    }

    /** @return array<string, mixed> */
    private function ringkas(AsetDokumen $aset): array
    {
        return [
            'id' => $aset->id,
            'nama' => $aset->nama,
            'jenjang' => $aset->jenjang,
            'mime' => $aset->mime,
            'lebar_px' => $aset->lebar_px,
            'tinggi_px' => $aset->tinggi_px,
            'ukuran_byte' => $aset->ukuran_byte,
            'url' => route('api.aset-dokumen.berkas', $aset),
            'dibuat_pada' => $aset->created_at?->toDateTimeString(),
        ];
    }
}
