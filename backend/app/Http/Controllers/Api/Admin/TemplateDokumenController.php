<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\PerPageLimit;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\TemplateDokumenRequest;
use App\Http\Requests\Admin\TemplateIsiRequest;
use App\Konteks\LembagaAktif;
use App\Models\TemplateDokumen;
use App\Services\Template\AsetGambar;
use App\Services\Template\DefinisiMedan;
use App\Services\Template\DokumenPdf;
use App\Services\Template\KatalogNilai;
use App\Services\Template\PdfIsian;
use App\Services\Template\PengisiNilai;
use App\Services\Template\PerenderHtml;
use App\Services\Template\TemplatePdfTidakValidException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Template cetak: daftar, unggah berkas PDF, susun medan, dan isi & cetak.
 * Seluruh cakupan lembaga dijaga TenantGuard; izin dijaga middleware route.
 */
class TemplateDokumenController extends Controller
{
    use PerPageLimit;
    use TenantGuard;
    use UrutDaftar;

    public function __construct(private readonly AsetGambar $aset) {}

    public function index(Request $request): JsonResponse
    {
        $jenjang = $this->jenjangUntukBerkas($request);
        $urut = $this->parseUrut($request, [
            'nama' => ['nama'],
            'kode' => ['kode'],
            'kategori' => ['kategori'],
            'jumlah_halaman' => ['jumlah_halaman'],
            'dibuat' => ['created_at'],
        ]);

        $daftar = TemplateDokumen::tersedia($jenjang)
            ->cari($request->input('q'))
            ->when($request->input('kategori'), fn ($q, $k) => $q->where('kategori', $k))
            ->when($request->input('jenis'), fn ($q, $j) => $q->where('jenis', $j))
            ->when($request->filled('aktif'), fn ($q) => $q->where('aktif', $request->boolean('aktif')));

        $this->terapkanUrut($daftar, $urut, [['nama', 'naik']], ['jenjang']);

        $total = (clone $daftar)->count();
        $halaman = max(1, (int) $request->input('page', 1));
        $perPage = $this->perPage($request);

        $data = $daftar->forPage($halaman, $perPage)->get()->map(fn (TemplateDokumen $t) => $this->ringkas($t))->all();

        return response()->json([
            'pesan' => 'Daftar template berhasil dimuat.',
            'data' => $data,
            'meta' => [
                'total' => $total,
                'page' => $halaman,
                'per_page' => $perPage,
                'last_page' => (int) max(1, ceil($total / max(1, $perPage))),
            ],
        ]);
    }

    public function katalog(): JsonResponse
    {
        return response()->json([
            'pesan' => 'Katalog nilai berhasil dimuat.',
            'data' => KatalogNilai::untukFrontend(),
        ]);
    }

    public function store(TemplateDokumenRequest $request): JsonResponse
    {
        $jenjang = $this->validasiJenjang($request);

        $definisi = DefinisiMedan::normalisasi($request->input('definisi', []), 999);

        $template = new TemplateDokumen;
        $template->kode = $this->kodeOtomatis($request);
        $template->fill([
            'nama' => $request->string('nama')->toString(),
            'kategori' => $request->string('kategori')->toString(),
            'jenis' => $request->string('jenis')->toString(),
            'deskripsi' => $request->input('deskripsi'),
            'jenjang' => $jenjang,
            'aktif' => $request->boolean('aktif', true),
            'definisi' => $definisi,
        ]);
        $template->dibuat_oleh = $request->user()->id;
        $template->jumlah_halaman = 1;
        $template->save();

        return response()->json([
            'pesan' => 'Template berhasil dibuat.',
            'data' => $this->ringkas($template, lengkap: true),
        ], 201);
    }

    public function show(Request $request, TemplateDokumen $template): JsonResponse
    {
        $this->pastikanTerlihat($request, $template);

        return response()->json([
            'pesan' => 'Detail template berhasil dimuat.',
            'data' => $this->ringkas($template, lengkap: true),
        ]);
    }

    public function update(TemplateDokumenRequest $request, TemplateDokumen $template): JsonResponse
    {
        $this->pastikanTerlihat($request, $template);

        DefinisiMedan::validasi($request->input('definisi', []), (int) $template->jumlah_halaman);

        $template->nama = $request->string('nama')->toString();

        // PATCH bersifat sebagian: hanya kolom yang benar-benar dikirim yang
        // ditimpa. Editor medan mengirim nama dan definisi saja, jadi tanpa
        // pemeriksaan ini setiap penyimpanan medan akan mengosongkan kategori,
        // deskripsi, dan cakupan lembaga, serta menonaktifkan template.
        if ($request->has('kategori')) {
            $template->kategori = $request->string('kategori')->toString();
        }

        if ($request->has('deskripsi')) {
            $template->deskripsi = $request->input('deskripsi');
        }

        if ($request->has('jenjang')) {
            $template->jenjang = $this->validasiJenjang($request);
        }

        if ($request->has('aktif')) {
            $template->aktif = $request->boolean('aktif');
        }

        if ($request->has('definisi')) {
            $template->definisi = DefinisiMedan::normalisasi(
                $request->input('definisi', []),
                (int) $template->jumlah_halaman,
            );
        }

        $template->save();

        return response()->json([
            'pesan' => 'Template berhasil disimpan.',
            'data' => $this->ringkas($template, lengkap: true),
        ]);
    }

    public function destroy(Request $request, TemplateDokumen $template): JsonResponse
    {
        $this->pastikanTerlihat($request, $template);

        $this->aset->hapusTemplate($template);
        $template->delete();

        return response()->json(['pesan' => 'Template berhasil dihapus.']);
    }

    /** Unggah berkas PDF template dan perbarui ukuran halamannya. */
    public function unggahBerkas(Request $request, TemplateDokumen $template): JsonResponse
    {
        $this->pastikanTerlihat($request, $template);

        $data = $request->validate([
            'berkas' => ['required', 'file', 'mimes:pdf', 'max:'.AsetGambar::MAKS_UPLOAD_PDF],
        ], [
            'berkas.mimes' => 'Berkas template harus berupa PDF.',
            'berkas.max' => 'Ukuran berkas template maksimal 20 MB.',
        ]);

        $jalurTmp = $data['berkas']->store('template/sementara', 'local');

        try {
            $ukuran = $this->ukurHalaman($jalurTmp);
        } catch (TemplatePdfTidakValidException $e) {
            return response()->json(['pesan' => $e->getMessage()], 422);
        }

        $this->aset->hapusTemplate($template);
        $template->path_pdf = $this->aset->simpanTemplate($data['berkas']);
        $template->halaman = $ukuran;
        $template->jumlah_halaman = count($ukuran);
        $template->save();

        return response()->json([
            'pesan' => 'Berkas template berhasil diunggah.',
            'data' => $this->ringkas($template, lengkap: true),
        ]);
    }

    /**
     * Berkas PDF template untuk editor.
     *
     * Disajikan di sini, bukan lewat route storage disk lokal, karena route
     * itu tidak dilindungi middleware auth. pdf.js di browser membaca
     * jawaban ini dengan header Authorization milik pengguna.
     */
    public function berkas(Request $request, TemplateDokumen $template): Response|BinaryFileResponse
    {
        $this->pastikanTerlihat($request, $template);

        $path = (string) ($template->path_pdf ?? '');

        abort_if($path === '', 404, 'Template ini belum memiliki berkas PDF. Unggah berkas template terlebih dahulu.');

        $penuh = Storage::disk(AsetGambar::DISK)->path($path);

        abort_unless(is_file($penuh), 404, 'Berkas template tidak ditemukan. Silakan unggah ulang.');

        return response()->file($penuh, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$template->kode.'.pdf"',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function duplikat(Request $request, TemplateDokumen $template): JsonResponse
    {
        $this->pastikanTerlihat($request, $template);

        $salinan = $template->replicate(['kode', 'nama', 'dibuat_oleh']);
        $salinan->kode = $this->kodeDariNama($template->nama.'-salinan');
        $salinan->nama = $template->nama.' (salinan)';
        $salinan->dibuat_oleh = $request->user()->id;
        $salinan->save();

        return response()->json([
            'pesan' => 'Template berhasil diduplikat.',
            'data' => $this->ringkas($salinan, lengkap: true),
        ], 201);
    }

    /** Isi template dengan satu record lalu kembalikan PDF untuk diunduh. */
    public function isiCetak(TemplateIsiRequest $request, TemplateDokumen $template): Response|JsonResponse
    {
        $this->pastikanTerlihat($request, $template);

        $konteks = $request->konteks($this->jenjangKonteks($request));
        $pengisi = new PengisiNilai($konteks);

        // Dua jenis template memakai dua mesin cetak. Pemilihannya di satu
        // tempat supaya tidak ada endpoint yang diam-diam memakai renderer
        // yang salah untuk jenis template tertentu.
        $generator = $template->jenis === TemplateDokumen::JENIS_HTML
            ? new PerenderHtml($template, $pengisi, $konteks)
            : new PdfIsian($template, $pengisi, $konteks);

        try {
            $isi = $generator->hasil();
        } catch (TemplatePdfTidakValidException $e) {
            return response()->json(['pesan' => $e->getMessage()], 422);
        }

        $nama = $generator->namaBerkas();

        if ($request->boolean('unduh')) {
            return response()->make($isi, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="'.$nama.'"',
            ]);
        }

        return response()->make($isi, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$nama.'"',
            'Content-Length' => (string) strlen($isi),
        ]);
    }

    /**
     * Baca ukuran tiap halaman dari berkas PDF, dalam milimeter.
     * Nilai FPDI berupa pelarut (210.00014444444) karena satuan internal PDF
     * adalah point, jadi hasilnya dibulatkan ke dua desimal.
     *
     * @return list<array{lebar_mm: float, tinggi_mm: float}>
     */
    private function ukurHalaman(string $jalurRelatif): array
    {
        $penuh = Storage::disk(AsetGambar::DISK)->path($jalurRelatif);

        if (! is_file($penuh)) {
            throw TemplatePdfTidakValidException::berkasHilang($jalurRelatif);
        }

        $pdf = new DokumenPdf;

        try {
            $jumlah = $pdf->setSourceFile($penuh);
        } catch (\Throwable $e) {
            throw TemplatePdfTidakValidException::dariPustaka($e);
        }

        $ukuran = [];

        for ($i = 1; $i <= $jumlah; $i++) {
            $s = $pdf->getTemplateSize($pdf->importPage($i));
            $ukuran[] = [
                'lebar_mm' => round((float) $s['width'], 2),
                'tinggi_mm' => round((float) $s['height'], 2),
            ];
        }

        return $ukuran;
    }

    private function validasiJenjang(Request $request): ?string
    {
        $jenjang = trim((string) $request->input('jenjang', ''));

        if ($jenjang === '') {
            return null;
        }

        $this->authorizeLembaga($request->user(), $jenjang);

        return $jenjang;
    }

    private function pastikanTerlihat(Request $request, TemplateDokumen $template): void
    {
        if ($template->jenjang !== null) {
            $this->authorizeLembaga($request->user(), $template->jenjang);
        }
    }

    /**
     * Lembaga tunggal untuk konteks cetak. Super admin yang sedang bertindak
     * memakai lembaga aktifnya; selain itu dipakai lembaga pertama yang boleh
     * diakses agar konteks tidak pernah kosong tanpa sebab.
     */
    private function jenjangKonteks(Request $request): string
    {
        $aktif = app(LembagaAktif::class)->id();

        if (is_string($aktif) && $aktif !== '') {
            return $aktif;
        }

        $daftar = $this->jenjangUntukBerkas($request);

        return $daftar === [] ? '' : (string) $daftar[0];
    }

    private function kodeOtomatis(Request $request): string
    {
        $kode = trim((string) $request->input('kode', ''));

        if ($kode !== '') {
            return $kode;
        }

        return $this->kodeDariNama($request->string('nama')->toString());
    }

    private function kodeDariNama(string $nama): string
    {
        $dasar = Str::slug($nama);
        $kandidat = $dasar !== '' ? $dasar : 'template';
        $kode = $kandidat;
        $urut = 2;

        while (TemplateDokumen::where('kode', $kode)->exists()) {
            $kode = $kandidat.'-'.$urut;
            $urut++;
        }

        return $kode;
    }

    /** @return array<string, mixed> */
    private function ringkas(TemplateDokumen $template, bool $lengkap = false): array
    {
        $data = [
            'id' => $template->id,
            'kode' => $template->kode,
            'nama' => $template->nama,
            'kategori' => $template->kategori,
            'jenis' => $template->jenis,
            'deskripsi' => $template->deskripsi,
            'jenjang' => $template->jenjang,
            'jumlah_halaman' => $template->jumlah_halaman,
            'aktif' => $template->aktif,
            'punya_berkas' => $template->path_pdf !== null && $template->path_pdf !== '',
            'jumlah_medan' => count($template->definisi['medan'] ?? []),
            'dibuat_pada' => $template->created_at?->toDateTimeString(),
        ];

        if (! $lengkap) {
            return $data;
        }

        $data['halaman'] = $template->halaman;
        $data['definisi'] = DefinisiMedan::normalisasi($template->definisi ?? [], (int) $template->jumlah_halaman);

        return $data;
    }
}
