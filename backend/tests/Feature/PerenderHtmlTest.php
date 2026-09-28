<?php

namespace Tests\Feature;

use App\Models\AsetDokumen;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\TemplateDokumen;
use App\Models\User;
use App\Services\Template\KatalogNilai;
use App\Services\Template\KonteksCetak;
use App\Services\Template\LebarHuruf;
use App\Services\Template\PengisiNilai;
use App\Services\Template\PerenderHtml;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Dompdf\Dompdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Renderer template jenis 'html': tata letak digambar sendiri dan dirender
 * dompdf, tanpa berkas PDF eksternal.
 *
 * Penempatan medan diuji lewat kotak potong yang ditulis dompdf sebagai
 * "<x> <y> <w> <h> re W n". Angka itu persis koordinat medan dalam point, jadi
 * posisi yang diklaim desainer bisa dibuktikan tanpa pdf.js.
 */
class PerenderHtmlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
        Storage::fake('local');
    }

    private function konteks(?int $santriId = null, string $tetapTeks = 'NAMA SANTRI UJI', ?int $kelasId = null): KonteksCetak
    {
        return new KonteksCetak(
            jenjang: 'MTS',
            tahunAjaran: '2026/2027',
            semester: '1',
            kelasId: $kelasId,
            pencetak: null,
            tetap: ['teks' => $tetapTeks, 'tanggal' => ''],
            tanggalAbsen: null,
            idSantri: $santriId,
            idPegawai: null,
            idPsbCalon: null,
        );
    }

    /**
     * @param  array<string, mixed>  $definisi
     */
    private function cetak(
        array $definisi,
        int $jumlahHalaman = 1,
        ?array $halaman = null,
        ?int $santriId = null,
        string $tetapTeks = 'NAMA SANTRI UJI',
        ?int $kelasId = null,
    ): string {
        $template = TemplateDokumen::create([
            'kode' => 'html-'.uniqid(),
            'nama' => 'Kop Sekolah',
            'jenis' => TemplateDokumen::JENIS_HTML,
            'kategori' => 'surat',
            'path_pdf' => null,
            'halaman' => $halaman ?? [['lebar_mm' => 210.0, 'tinggi_mm' => 297.0]],
            'jumlah_halaman' => $jumlahHalaman,
            'definisi' => $definisi,
        ]);

        $konteks = $this->konteks($santriId, $tetapTeks, $kelasId);

        return (new PerenderHtml($template, new PengisiNilai($konteks), $konteks))->hasil();
    }

    /** @param array<string, mixed> $medan */
    private function medan(array $medan): array
    {
        return ['medan' => [$medan + ['gaya' => ['ukuran' => 11]]]];
    }

    public function test_medan_tercetak_pada_koordinat_yang_sama_pakai_milimeter(): void
    {
        $pdf = $this->cetak($this->medan([
            'tipe' => 'teks', 'label' => 'Nama', 'halaman' => 1,
            'x' => 60, 'y' => 78.5, 'w' => 110, 'h' => 7,
            'sumber' => 'tetap', 'kunci' => 'teks',
        ]));

        $kotak = $this->kotakTeras($pdf);

        $this->assertCount(1, $kotak, 'Harus ada tepat satu kotak medan.');

        // x, y dari bawah, lebar, tinggi dalam milimeter.
        $this->assertEqualsWithDelta(60.0, $kotak[0]['x'], 0.2);
        $this->assertEqualsWithDelta(110.0, $kotak[0]['w'], 0.2);
        $this->assertEqualsWithDelta(7.0, $kotak[0]['h'], 0.2);

        // y diukur dari bawah halaman: 297 - 78,5 = 218,5 mm.
        $this->assertEqualsWithDelta(218.5, $kotak[0]['y'], 0.2);
    }

    public function test_font_inti_pdf_tidak_di_embed_biar_berkasa_kecil_dan_teksnya_bisa_dicari(): void
    {
        foreach (['helvetica', 'times', 'courier'] as $font) {
            $pdf = $this->cetak($this->medan([
                'tipe' => 'teks', 'label' => 'Teks', 'halaman' => 1,
                'x' => 20, 'y' => 30, 'w' => 120, 'h' => 8,
                'sumber' => 'tetap', 'kunci' => 'teks',
                'gaya' => ['font' => $font],
            ]), tetapTeks: 'NIP 1234567890123456');

            $this->assertStringNotContainsString(
                '/FontFile',
                $pdf,
                "Font inti $font tidak boleh di-embed; gly-nya sudah ada di pembaca PDF.",
            );
            $this->assertStringContainsString(
                'NIP 1234567890123456',
                implode('', $this->aliranIsi($pdf)),
                "Teks pada font inti $font harus tetap ASCII yang bisa dicari.",
            );
        }
    }

    public function test_pilihan_dejavusans_tetap_memakai_dejavusans(): void
    {
        $pdf = $this->cetak($this->medan([
            'tipe' => 'teks', 'label' => 'Teks', 'halaman' => 1,
            'x' => 20, 'y' => 30, 'w' => 120, 'h' => 8,
            'sumber' => 'tetap', 'kunci' => 'teks',
            'gaya' => ['font' => 'dejavusans'],
        ]), tetapTeks: 'NIP 1234567890123456');

        // Pilihan desainer harus dihormati, bukan jatuh ke Helvetica.
        $this->assertMatchesRegularExpression(
            '/\/BaseFont\s*\/?[A-Z]{6}\+?DejaVuSans/',
            $pdf,
        );
    }

    public function test_ukuran_halaman_mengikuti_template_bukan_selalu_a4(): void
    {
        $pdf = $this->cetak(
            $this->medan([
                'tipe' => 'teks', 'label' => 'X', 'halaman' => 1,
                'x' => 10, 'y' => 10, 'w' => 100, 'h' => 8,
                'sumber' => 'tetap', 'kunci' => 'teks',
            ]),
            halaman: [['lebar_mm' => 148.0, 'tinggi_mm' => 210.0]],
        );

        $ukuran = $this->ukuranHalaman($pdf);

        $this->assertNotNull($ukuran, 'PDF harus punya MediaBox.');
        $this->assertEqualsWithDelta(148.0, $ukuran['lebar_mm'], 0.5);
        $this->assertEqualsWithDelta(210.0, $ukuran['tinggi_mm'], 0.5);
    }

    public function test_beberapa_medan_berpindah_tetap_masing_masing_di_kotaknya(): void
    {
        $pdf = $this->cetak(['medan' => [
            ['tipe' => 'teks', 'label' => 'A', 'halaman' => 1, 'x' => 20, 'y' => 30, 'w' => 60, 'h' => 6, 'sumber' => 'tetap', 'kunci' => 'teks', 'gaya' => ['ukuran' => 10]],
            ['tipe' => 'teks', 'label' => 'B', 'halaman' => 1, 'x' => 20, 'y' => 50, 'w' => 60, 'h' => 6, 'sumber' => 'tetap', 'kunci' => 'teks', 'gaya' => ['ukuran' => 10]],
        ]]);

        $kotak = $this->kotakTeras($pdf);

        $this->assertCount(2, $kotak);
        $this->assertEqualsWithDelta(30.0, 297.0 - $kotak[0]['y'], 0.2, 'Medan pertama di 30 mm dari atas.');
        $this->assertEqualsWithDelta(50.0, 297.0 - $kotak[1]['y'], 0.2, 'Medan kedua di 50 mm dari atas.');
    }

    public function test_medan_berulang_membuat_satu_kotak_per_kolom_per_baris(): void
    {
        $f = $this->fixtureKelas();

        $pdf = $this->cetak(['medan' => [[
            'tipe' => 'baris_berulang', 'label' => 'Daftar', 'halaman' => 1,
            'x' => 20, 'y' => 100, 'w' => 170, 'h' => 40,
            'baris_berulang' => [
                'sumber' => 'daftar_santri_kelas',
                'jumlah' => 2,
                'tinggi_baris' => 8,
                'kolom' => [
                    ['x' => 0, 'w' => 20, 'sumber' => 'baris', 'kunci' => 'no_urut', 'gaya' => ['ukuran' => 9]],
                    ['x' => 25, 'w' => 80, 'sumber' => 'baris', 'kunci' => 'nama_lengkap', 'gaya' => ['ukuran' => 9]],
                ],
            ],
        ]]], kelasId: $f['kelas']->id);

        $kotak = $this->kotakTeras($pdf);

        // Dua kolom, masing-masing punya satu sel kepala plus dua sel baris.
        $this->assertCount(6, $kotak, 'Dua kolom dua baris harus menghasilkan enam sel termasuk kepala.');

        // Baris kedua harus setinggi satu baris di bawah baris pertama; kepala
        // memiliki bandnya sendiri di atas keduanya.
        $kiri = array_values(array_filter($kotak, fn (array $s): bool => $s['x'] < 30.0));
        $this->assertCount(3, $kiri, 'Kolom pertama harus punya sel kepala dan dua sel baris.');

        $tinggiBaris = array_map(fn (array $s): float => 297.0 - $s['y'], $kiri);
        sort($tinggiBaris);

        $this->assertEqualsWithDelta(100.0, $tinggiBaris[0], 0.3, 'Kepala tabel di 100 mm dari atas.');
        $this->assertEqualsWithDelta(106.0, $tinggiBaris[1], 0.3, 'Baris pertama di 106 mm dari atas.');
        $this->assertEqualsWithDelta(114.0, $tinggiBaris[2], 0.3, 'Baris kedua di 114 mm dari atas.');
    }

    public function test_kepala_tabel_memakai_label_kolom_dan_latar_yang_dijukan(): void
    {
        $f = $this->fixtureKelas();
        $pdf = $this->cetak(['medan' => [[
            'tipe' => 'baris_berulang', 'label' => 'Daftar', 'halaman' => 1,
            'x' => 20, 'y' => 100, 'w' => 170, 'h' => 40,
            'baris_berulang' => [
                'sumber' => 'daftar_santri_kelas',
                'jumlah' => 1,
                'tinggi_baris' => 8,
                'tinggi_kepala' => 6,
                'kolom' => [
                    ['x' => 0, 'w' => 20, 'label' => 'No', 'sumber' => 'baris', 'kunci' => 'no_urut'],
                    ['x' => 25, 'w' => 80, 'label' => 'Nama Lengkap', 'sumber' => 'baris', 'kunci' => 'nama_lengkap'],
                ],
                'gaya' => [
                    'garis_sel' => 0.25,
                    'warna_garis' => '#7a7a7a',
                    'warna_kepala' => '#f1f1f1',
                    'tebal_kepala' => true,
                ],
            ],
        ]]], kelasId: $f['kelas']->id);

        $aliran = implode('', $this->aliranIsi($pdf));

        $this->assertStringContainsString('Nama Lengkap', $aliran, 'Kepala kolom memakai label kolom.');

        // Dompdf menerjemahkan border dan latar jadi operasi canvas, bukan
        // deklarasi CSS, jadi yang diperiksa adalah warna dan tebalnya.
        $this->assertContains('0.478 0.478 0.478', $this->warnaGaris($aliran), 'Garis sel #7a7a7a.');
        $this->assertContains('0.945 0.945 0.945', $this->warnaIsian($aliran), 'Kepala tabel berlatar #f1f1f1.');

        // 0,125 mm = 0,3543 pt: setengah dari garis_sel 0,25 mm supaya garis
        // antar-sel tidak menjadi dua kali tebal.
        $this->assertMatchesRegularExpression(
            '/0\.3543\d* w/',
            $aliran,
            'Tebal garis sel harus setengah dari garis_sel, seperti border-collapse.',
        );
    }

    public function test_tabel_tanpa_garis_sel_tidak_menggambar_border(): void
    {
        $f = $this->fixtureKelas();
        $pdf = $this->cetak(['medan' => [[
            'tipe' => 'baris_berulang', 'label' => 'Daftar', 'halaman' => 1,
            'x' => 20, 'y' => 100, 'w' => 170, 'h' => 40,
            'baris_berulang' => [
                'sumber' => 'daftar_santri_kelas',
                'jumlah' => 1,
                'tinggi_baris' => 8,
                'kolom' => [
                    ['x' => 0, 'w' => 20, 'label' => 'No', 'sumber' => 'baris', 'kunci' => 'no_urut'],
                ],
                'gaya' => ['garis_sel' => 0, 'warna_kepala' => null],
            ],
        ]]], kelasId: $f['kelas']->id);

        $aliran = implode('', $this->aliranIsi($pdf));

        $this->assertStringNotContainsString('re S', $aliran, 'Tanpa garis_sel tidak boleh ada sel yang digores.');
        $this->assertStringNotContainsString('0.945 0.945 0.945', $aliran, 'Latar kepala harus kosong.');
    }

    public function test_medan_berulang_tanpa_kelas_tidak_menggambar_baris(): void
    {
        $this->fixtureKelas();

        $pdf = $this->cetak(['medan' => [[
            'tipe' => 'baris_berulang', 'label' => 'Daftar', 'halaman' => 1,
            'x' => 20, 'y' => 100, 'w' => 170, 'h' => 40,
            'baris_berulang' => [
                'sumber' => 'daftar_santri_kelas', 'jumlah' => 2, 'tinggi_baris' => 8,
                'kolom' => [['x' => 0, 'w' => 20, 'sumber' => 'baris', 'kunci' => 'no_urut', 'gaya' => ['ukuran' => 9]]],
            ],
        ]]]);

        $this->assertSame([], $this->kotakTeras($pdf), 'Tanpa kelas aktif tidak boleh ada baris tergambar.');
    }

    public function test_semua_tipe_medan_berhasil_dirender_tanpa_gagal(): void
    {
        $aset = AsetDokumen::create([
            'nama' => 'Stempel Madrasah', 'path' => 'aset/stempel.png', 'mime' => 'image/png',
            'lebar_px' => 1, 'tinggi_px' => 1, 'ukuran_byte' => 68,
        ]);
        Storage::disk('local')->put('aset/stempel.png', $this->gambarPng());

        $pdf = $this->cetak(['medan' => [
            ['tipe' => 'teks', 'label' => 'Nama', 'halaman' => 1, 'x' => 20, 'y' => 20, 'w' => 120, 'h' => 8, 'sumber' => 'tetap', 'kunci' => 'teks', 'gaya' => ['ukuran' => 12]],
            ['tipe' => 'paragraf', 'label' => 'Teks', 'halaman' => 1, 'x' => 20, 'y' => 40, 'w' => 170, 'h' => 30, 'sumber' => 'tetap', 'kunci' => 'teks', 'gaya' => ['ukuran' => 10]],
            ['tipe' => 'gambar', 'label' => 'Logo', 'halaman' => 1, 'x' => 20, 'y' => 80, 'w' => 30, 'h' => 15, 'sumber' => 'aset', 'kunci' => KatalogNilai::kunciAset($aset->id), 'gaya' => ['ukuran' => 10]],
            ['tipe' => 'centang', 'label' => 'Centang', 'halaman' => 1, 'x' => 60, 'y' => 80, 'w' => 6, 'h' => 6, 'sumber' => 'tetap', 'kunci' => 'teks', 'bawa' => 'NAMA SANTRI UJI', 'huruf' => 'X', 'huruf_kosong' => ' ', 'gaya' => ['ukuran' => 11]],
            ['tipe' => 'tanda_tangan', 'label' => 'Ttd', 'halaman' => 1, 'x' => 120, 'y' => 100, 'w' => 40, 'h' => 20, 'gaya' => ['ukuran' => 10]],
            ['tipe' => 'halaman_otomatis', 'label' => 'Hal', 'halaman' => 1, 'x' => 20, 'y' => 120, 'w' => 40, 'h' => 6, 'format' => 'Hal {halaman}/{jumlah}', 'gaya' => ['ukuran' => 9]],
        ]]);

        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertStringContainsString('%%EOF', $pdf);

        // Tanda tangan memang sengaja tidak digambar, jadi hanya lima tipe
        // lain yang menghasilkan kotak.
        // Tanda tangan memang dilewati, jadi enam tipe lain harus
        // menggambar kotak potong, gambar ikut termasuk.
        $kotak = $this->kotakTeras($pdf);
        $this->assertCount(5, $kotak, 'Lima tipe selain tanda tangan harus menggambar kotak.');

        // Kotak gambar harus ikut bergeser bersama halaman.
        $kotakGambar = array_values(array_filter($kotak, fn (array $s): bool => $s['w'] < 40.0 && $s['h'] < 20.0));
        $this->assertNotEmpty($kotakGambar, 'Medan gambar harus punya kotak sendiri.');
        $this->assertEqualsWithDelta(30.0, $kotakGambar[0]['w'], 0.3);
        $this->assertEqualsWithDelta(15.0, $kotakGambar[0]['h'], 0.3);

        // Gambar disematkan sebagai objek gambar di dalam kotak itu.
        $this->assertStringContainsString('/Subtype /Image', $pdf, 'Medan gambar harus tertanam di PDF.');
    }

    public function test_medan_tanpa_nilai_tidak_membuat_kotak(): void
    {
        $pdf = $this->cetak($this->medan([
            'tipe' => 'teks', 'label' => 'Kosong', 'halaman' => 1,
            'x' => 20, 'y' => 20, 'w' => 100, 'h' => 8,
            'sumber' => 'santri', 'kunci' => 'nama_lengkap',
        ]), santriId: null);

        $this->assertSame([], $this->kotakTeras($pdf), 'Medan tanpa nilai tidak boleh menggambar kotak kosong.');
    }

    public function test_dua_halaman_berhasil_dirender(): void
    {
        $pdf = $this->cetak(['medan' => [
            ['tipe' => 'halaman_otomatis', 'label' => 'Hal', 'halaman' => 1, 'x' => 20, 'y' => 20, 'w' => 40, 'h' => 6, 'format' => '{halaman}', 'gaya' => ['ukuran' => 10]],
            ['tipe' => 'halaman_otomatis', 'label' => 'Hal', 'halaman' => 2, 'x' => 20, 'y' => 20, 'w' => 40, 'h' => 6, 'format' => '{halaman}', 'gaya' => ['ukuran' => 10]],
        ]], jumlahHalaman: 2);

        $this->assertGreaterThanOrEqual(2, $this->jumlahObjekHalaman($pdf));
    }

    public function test_lebar_huruf_liner_terhadap_ukuran_huruf(): void
    {
        $lebar = $this->lebarHuruf();
        $font = "'DejaVu Sans', sans-serif";

        $this->assertSame(0.0, $lebar->lebar('', 12, $font));
        $this->assertLessThan(
            $lebar->lebar('MMM', 12, $font),
            $lebar->lebar('iii', 12, $font),
            'Huruf sempit harus lebih kecil lebarnya dari huruf lebar.',
        );

        $satu = $lebar->lebar('Nama Santri', 10, $font);
        $this->assertEqualsWithDelta($satu * 2, $lebar->lebar('Nama Santri', 20, $font), 0.05);
    }

    public function test_teks_pendek_tidak_diperkecil_dan_teks_panjang_diperkecil(): void
    {
        $lebar = $this->lebarHuruf();
        $font = "'DejaVu Sans', sans-serif";

        $this->assertSame(12.0, $lebar->ukuranMuat('Nama', 170, 8, 12, 6, $font));

        $ukuran = $lebar->ukuranMuat('Nama Santri yang panjang sekali', 40, 8, 14, 6, $font);

        $this->assertLessThan(14.0, $ukuran, 'Teks panjang harus dikecilkan.');
        $this->assertGreaterThanOrEqual(6.0, $ukuran, 'Ukuran tidak boleh di bawah huruf minimum.');
        $this->assertLessThanOrEqual(
            40.0,
            $lebar->lebar('Nama Santri yang panjang sekali', $ukuran, $font),
            'Setelah dikecilkan teks harus muat di dalam kotak.',
        );
    }

    public function test_teks_yang_tidak_muat_dipotong_dengan_elipsis(): void
    {
        $lebar = $this->lebarHuruf();
        $font = "'DejaVu Sans', sans-serif";

        $this->assertSame('Nama', $lebar->satuBaris('Nama', 170, 11, $font));

        $potong = $lebar->satuBaris('Nama Sangat Panjang Sekali', 20, 11, $font);

        $this->assertStringEndsWith('...', $potong);
        $this->assertLessThanOrEqual(20.0, $lebar->lebar($potong, 11, $font));
    }

    public function test_teks_yang_memenuhi_kotak_disisakan_margin_aman(): void
    {
        $lebar = $this->lebarHuruf();
        $font = "'DejaVu Sans', sans-serif";
        $teks = 'Halaman 2 dari 2';

        // Lebar teks persis seukuran kotak akan menggigit tepi potong dompdf,
        // jadi ukuran yang dipilih harus lebih kecil daripada ukuran yang
        // persis muat.
        $ukuranPas = $lebar->ukuranMuat($teks, $lebar->lebar($teks, 9, $font), 6, 9, 6, $font);
        $this->assertLessThan(9.0, $ukuranPas, 'Teks yang tepat sebanding kotak harus dikecilkan sedikit.');
        $this->assertGreaterThanOrEqual(6.0, $ukuranPas);
        $this->assertLessThanOrEqual($lebar->lebar($teks, 9, $font), $lebar->lebar($teks, $ukuranPas, $font));
    }

    public function test_jumlah_baris_makin_sempit_kotak_makin_banyak(): void
    {
        $lebar = $this->lebarHuruf();
        $font = "'DejaVu Sans', sans-serif";
        $panjang = str_repeat('kata yang cukup panjang ', 12);

        $this->assertSame(1, $lebar->jumlahBaris('Nama Santri', 170, 10, $font));
        $this->assertSame(0, $lebar->jumlahBaris('   ', 170, 10, $font));

        $lebar170 = $lebar->jumlahBaris($panjang, 170, 10, $font);
        $lebar40 = $lebar->jumlahBaris($panjang, 40, 10, $font);

        $this->assertGreaterThan(1, $lebar170);
        $this->assertGreaterThan($lebar170, $lebar40, 'Kotak lebih sempit harus menghasilkan lebih banyak baris.');
    }

    public function test_ukuran_muat_mengormati_jumlah_baris_pada_teks_yang_dilipat(): void
    {
        $lebar = $this->lebarHuruf();
        $font = "'DejaVu Sans', sans-serif";
        $teks = str_repeat('Kalimat panjang yang harus dilipat ', 8);

        $ukuran = $lebar->ukuranMuat($teks, 170, 20, 14, 8, $font, 0.0, 1.2, bungkus: true);

        $this->assertLessThan(14.0, $ukuran, 'Teks berlipat harus dikecilkan dari ukuran asal.');
        $this->assertGreaterThanOrEqual(8.0, $ukuran, 'Ukuran tidak boleh di bawah huruf minimum.');

        // Tinggi total teks setelah dilipat harus muat di dalam kotak.
        $tinggi = $lebar->jumlahBaris($teks, 170, $ukuran, $font) * $ukuran * 1.2 * 25.4 / 72;
        $this->assertLessThanOrEqual(20.0, $tinggi + 0.01, 'Teks hasil pengecilan harus muat di dalam kotak.');
    }

    /**
     * Satu kelas berisi dua Santri pada tahun ajaran yang sama dengan
     * konteks cetak.
     *
     * @return array{kelas: Kelas}
     */
    private function fixtureKelas(): array
    {
        Lembaga::create(['nama' => 'MTS Uji', 'jenjang' => 'MTS', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);

        $kelas = Kelas::create([
            'jenjang' => 'MTS', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '7A', 'tingkat' => 'VII',
        ]);

        foreach ([['Ahmad Fauzi', 7], ['Budi Santoso', 3]] as [$nama, $absen]) {
            $santri = Santri::create([
                'nama_lengkap' => $nama, 'jk' => 'L', 'tipe_santri' => 'asrama',
                'tmp_lahir' => 'Bandung', 'tgl_lahir' => '2012-05-17', 'nisn' => '00812'.$absen,
            ]);
            LembagaSantri::create([
                'santri_id' => $santri->id, 'jenjang' => 'MTS', 'nis_lokal' => '2026-'.$absen,
                'is_active_lembaga' => 'Ya',
            ]);
            $santri->riwayatBelajar()->create([
                'tahun_ajaran' => '2026/2027', 'jenjang' => 'MTS', 'kelas_id' => $kelas->id,
                'semester' => '1', 'no_absen' => $absen, 'is_active_riwayat' => 'Ya',
            ]);
        }

        return compact('kelas');
    }

    public function test_endpoint_isi_memakai_renderer_html_untuk_template_jenis_html(): void
    {
        $this->actingAs($this->operator(), 'sanctum');

        $id = $this->actingAs($this->operator(), 'sanctum')
            ->postJson('/api/admin/template-dokumen', [
                'nama' => 'Kop Madrasah', 'kategori' => 'surat', 'jenis' => 'html',
            ])
            ->assertCreated()
            ->assertJsonPath('data.jenis', 'html')
            ->json('data.id');

        $this->actingAs($this->operator(), 'sanctum')
            ->patchJson('/api/admin/template-dokumen/'.$id, [
                'nama' => 'Kop Madrasah', 'kategori' => 'surat',
                'definisi' => ['medan' => [[
                    'tipe' => 'teks', 'label' => 'Nama', 'halaman' => 1,
                    'x' => 60, 'y' => 78.5, 'w' => 110, 'h' => 7,
                    'sumber' => 'tetap', 'kunci' => 'teks',
                ]]],
            ])
            ->assertOk();

        $res = $this->actingAs($this->operator(), 'sanctum')
            ->postJson('/api/admin/template-dokumen/'.$id.'/isi', [
                'tetap' => ['teks' => 'NAMA SANTRI UJI'],
            ])
            ->assertOk();

        $this->assertSame('application/pdf', $res->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF-', $res->getContent());
    }

    private function operator(): User
    {
        $user = User::create([
            'name' => 'Operator TU', 'email' => 'tu-'.uniqid().'@example.com', 'password' => 'password',
        ]);
        $user->assignRole('super_admin');

        return $user;
    }

    private function lebarHuruf(): LebarHuruf
    {
        return new LebarHuruf((new Dompdf(['isRemoteEnabled' => false]))->getFontMetrics());
    }

    /**
     * Kotak potong yang ditulis dompdf untuk setiap medan, dalam milimeter.
     *
     * Operator "re" menerima (x, y, lebar, tinggi) dengan y diukur dari bawah
     * kotak, jadi tepi atas kotak adalah y + tinggi. Yang dikembalikan di
     * sini adalah tepi atas, supaya sama dengan yang dipakai koordinat medan
     * (dari atas halaman) setelah dikurangi tinggi halaman.
     *
     * @return list<array{x: float, y: float, w: float, h: float}>
     */
    private function kotakTeras(string $pdf, bool $tanpaLatar = false): array
    {
        $hasil = [];

        foreach ($this->aliranIsi($pdf) as $isi) {
            if (preg_match_all(
                '/([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+re\s+W\s*n/',
                $isi,
                $cocok,
                PREG_SET_ORDER,
            ) === 0) {
                continue;
            }

            foreach ($cocok as $satu) {
                // Kotak sebesar halaman dari titik 0,0 adalah latar, bukan medan.
                if ((float) $satu[3] > 700.0 && (float) $satu[4] > 800.0) {
                    continue;
                }

                if ($tanpaLatar) {
                    $lebar = (float) $satu[3] * 25.4 / 72;
                    $tinggi = (float) $satu[4] * 25.4 / 72;

                    // Latar halaman juga digambar dengan re; yang dicari di sini
                    // hanya kotak medan, jadi yang sebesar halaman dilewati.
                    if ($lebar > 200.0 && $tinggi > 280.0) {
                        continue;
                    }
                }

                $hasil[] = [
                    'x' => round((float) $satu[1] * 25.4 / 72, 2),
                    'y' => round(((float) $satu[2] + (float) $satu[4]) * 25.4 / 72, 2),
                    'w' => round((float) $satu[3] * 25.4 / 72, 2),
                    'h' => round((float) $satu[4] * 25.4 / 72, 2),
                ];
            }
        }

        return $hasil;
    }

    /**
     * Garis horizontal yang digambar dompdf, dalam milimeter dan point.
     *
     * Garis ditulis sebagai path "x1 y1 m x1 y1 l ... S" dan bukan kotak
     * potong, jadi dibaca dari operatornya.
     *
     * @return list<array{x: float, panjang: float, tebal_pt: float}>
     */
    private function garisTeras(string $pdf): array
    {
        $hasil = [];

        foreach ($this->aliranIsi($pdf) as $isi) {
            $pola = '/([0-9.]+)\s+w\s+0\s+J[^\n]*\n[^\n]*?([0-9.]+)\s+([0-9.]+)\s+m\s+([0-9.]+)\s+([0-9.]+)\s+l\s+S/';

            if (preg_match_all($pola, $isi, $cocok, PREG_SET_ORDER) === 0) {
                continue;
            }

            // Group: 1 lebar garis, 2 x awal, 3 y awal, 4 x akhir, 5 y akhir.
            foreach ($cocok as $satu) {
                $hasil[] = [
                    'x' => (float) $satu[2] * 25.4 / 72,
                    'panjang' => abs((float) $satu[2] - (float) $satu[4]) * 25.4 / 72,
                    'tebal_pt' => (float) $satu[1],
                ];
            }
        }

        return $hasil;
    }

    /**
     * Warna isian yang ditulis operator rg, dalam bentuk teks apa adanya.
     *
     * @return list<string>
     */
    private function warnaIsian(string $isi): array
    {
        preg_match_all('/([0-9.]+ [0-9.]+ [0-9.]+) rg/', $isi, $cocok);

        return $cocok[1] ?? [];
    }

    /** @return list<string> */
    private function warnaGaris(string $isi): array
    {
        preg_match_all('/([0-9.]+ [0-9.]+ [0-9.]+) RG/', $isi, $cocok);

        return $cocok[1] ?? [];
    }

    /** @return array{lebar_mm: float, tinggi_mm: float}|null */
    private function ukuranHalaman(string $pdf): ?array
    {
        if (preg_match('#/MediaBox\s*\[\s*[0-9.]+\s+[0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*\]#', $pdf, $cocok) !== 1) {
            return null;
        }

        return [
            'lebar_mm' => (float) $cocok[1] * 25.4 / 72,
            'tinggi_mm' => (float) $cocok[2] * 25.4 / 72,
        ];
    }

    private function jumlahObjekHalaman(string $pdf): int
    {
        return preg_match_all('#/Type\s*/Page[^s]#', $pdf) ?: 0;
    }

    /**
     * Isi setiap stream PDF, sudah diurai dari Flate.
     *
     * Panjang stream diambil dari `/Length` di dictionary, bukan dari
     * jarak sampai `endstream`: dompdf tidak selalu menulis baris baru
     * sebelum `endstream`, sehingga pencarian berbasis pola bisa memotong
     * data dan gagal diurai.
     *
     * @return list<string>
     */
    private function aliranIsi(string $pdf): array
    {
        $daftar = [];
        $offset = 0;

        while (preg_match('/\/Length\s+(\d+)/', $pdf, $cocok, PREG_OFFSET_CAPTURE, $offset) === 1) {
            $panjang = (int) $cocok[1][0];
            $mulai = strpos($pdf, 'stream', $cocok[1][1]);

            if ($mulai === false) {
                break;
            }

            // Lewati kata 'stream' dan baris baru setelahnya.
            $mulai += strlen('stream');
            $mulai += strspn($pdf, "\r\n", $mulai);
            $offset = $mulai + $panjang;

            if ($offset > strlen($pdf)) {
                break;
            }

            $mentah = substr($pdf, $mulai, $panjang);
            $isi = @gzuncompress($mentah) ?: @gzinflate($mentah);

            if ($isi !== false) {
                $daftar[] = $isi;
            }
        }

        return $daftar;
    }

    /** PNG 1x1 supaya aset gambar bisa diuji tanpa berkas biner di repo. */
    private function gambarPng(): string
    {
        return (string) base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }

    public function test_garis_digambar_sebagai_garis_panjang_tebal_mm(): void
    {
        $pdf = $this->cetak(['medan' => [[
            'tipe' => 'garis', 'label' => 'Garis kop', 'halaman' => 1,
            'x' => 20, 'y' => 42, 'w' => 170, 'h' => 0.8,
            'gaya' => ['warna' => '#000000', 'tebal_mm' => 0.8],
        ]]]);

        $garis = $this->garisTeras($pdf);

        $this->assertCount(1, $garis, 'Garis harus digambar tepat satu.');
        $this->assertEqualsWithDelta(20.0, $garis[0]['x'], 0.3, 'Garis mulai di kiri kotak.');
        $this->assertEqualsWithDelta(170.0, $garis[0]['panjang'], 0.5, 'Panjang garis sama dengan lebar kotak.');
        // 0,8 mm sama dengan 0,8 * 72 / 25,4 point.
        $this->assertEqualsWithDelta(0.8 * 72 / 25.4, $garis[0]['tebal_pt'], 0.01, 'Tebal garis mengikuti gaya dalam milimeter.');
    }

    public function test_kotak_berborder_dan_berlatar_digambar(): void
    {
        $pdf = $this->cetak(['medan' => [[
            'tipe' => 'kotak', 'label' => 'Judul seksi', 'halaman' => 1,
            'x' => 20, 'y' => 50, 'w' => 170, 'h' => 7,
            'gaya' => ['warna' => '#333333', 'tebal_mm' => 0.3, 'isi' => '#e8e8e8'],
        ]]]);

        $kotak = $this->kotakTeras($pdf, tanpaLatar: true);

        $this->assertNotEmpty($kotak, 'Kotak harus menggambar garisnya sendiri.');
        $satu = $kotak[0];

        // Dompdf mengukur kotak dalam. Lebar dikurangi dua kali tebal border
        // supaya ukuran luarnya tetap 170 mm seperti yang diminta desainer.
        $this->assertEqualsWithDelta(170.0 - 2 * 0.3, $satu['w'], 0.3);
        $this->assertEqualsWithDelta(7.0 - 2 * 0.3, $satu['h'], 0.3);

        // kotakTeras mengembalikan tepi atas, jadi jarak dari atas halaman
        // langsung mengurangi tinggi halaman dengan tepi itu.
        $this->assertEqualsWithDelta(50.0, 297.0 - $satu['y'], 0.4, 'Tepi atas kotak di 50 mm dari atas.');

        // Isian abu-abu (#e8e8e8) diteruskan sebagai operator rg.
        $warna = $this->warnaIsian($this->aliranIsi($pdf)[0] ?? '');

        $this->assertContains('0.910 0.910 0.910', $warna, 'Warna isian kotak harus diteruskan ke PDF.');
    }

    public function test_kotak_tanpa_isi_tidak_menggambar_latar(): void
    {
        $pdf = $this->cetak(['medan' => [[
            'tipe' => 'kotak', 'label' => 'Pembatas', 'halaman' => 1,
            'x' => 20, 'y' => 50, 'w' => 60, 'h' => 10,
            'gaya' => ['warna' => '#000000', 'tebal_mm' => 0.3, 'isi' => null],
        ]]]);

        // Latar halaman sendiri berwarna putih, jadi yang diperiksa tidak boleh
        // ada warna isian lain.
        $warna = array_values(array_filter(
            $this->warnaIsian($this->aliranIsi($pdf)[0] ?? ''),
            fn (string $rgb): bool => trim($rgb) !== '1.000 1.000 1.000',
        ));

        $this->assertSame([], $warna, 'Kotak tanpa isian tidak boleh mengisi warna.');
        $this->assertNotEmpty($this->kotakTeras($pdf, tanpaLatar: true), 'Border kotak tetap harus ada.');
    }
}
