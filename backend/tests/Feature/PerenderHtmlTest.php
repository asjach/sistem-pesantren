<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\TemplateDokumen;
use App\Models\User;
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

        // Dua baris, dua kolom, tiap kolom punya kotak sendiri.
        $this->assertCount(4, $kotak, 'Dua baris dua kolom harus menghasilkan empat kotak.');

        // Baris kedua harus setinggi satu baris di bawah baris pertama.
        $kiri = array_values(array_filter($kotak, fn (array $s): bool => $s['x'] < 30.0));
        $this->assertCount(2, $kiri, 'Kolom pertama harus punya dua kotak.');

        $tinggiBaris = array_map(fn (array $s): float => 297.0 - $s['y'], $kiri);
        sort($tinggiBaris);

        $this->assertEqualsWithDelta(100.0, $tinggiBaris[0], 0.3, 'Baris pertama di 100 mm dari atas.');
        $this->assertEqualsWithDelta(108.0, $tinggiBaris[1], 0.3, 'Baris kedua di 108 mm dari atas.');
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
        Storage::disk('local')->put('aset/stempel.png', $this->gambarPng());

        $pdf = $this->cetak(['medan' => [
            ['tipe' => 'teks', 'label' => 'Nama', 'halaman' => 1, 'x' => 20, 'y' => 20, 'w' => 120, 'h' => 8, 'sumber' => 'tetap', 'kunci' => 'teks', 'gaya' => ['ukuran' => 12]],
            ['tipe' => 'paragraf', 'label' => 'Teks', 'halaman' => 1, 'x' => 20, 'y' => 40, 'w' => 170, 'h' => 30, 'sumber' => 'tetap', 'kunci' => 'teks', 'gaya' => ['ukuran' => 10]],
            ['tipe' => 'gambar', 'label' => 'Logo', 'halaman' => 1, 'x' => 20, 'y' => 80, 'w' => 30, 'h' => 15, 'sumber' => 'aset', 'kunci' => 'path', 'gaya' => ['ukuran' => 10]],
            ['tipe' => 'centang', 'label' => 'Centang', 'halaman' => 1, 'x' => 60, 'y' => 80, 'w' => 6, 'h' => 6, 'sumber' => 'tetap', 'kunci' => 'teks', 'bawa' => 'NAMA SANTRI UJI', 'huruf' => 'X', 'huruf_kosong' => ' ', 'gaya' => ['ukuran' => 11]],
            ['tipe' => 'tanda_tangan', 'label' => 'Ttd', 'halaman' => 1, 'x' => 120, 'y' => 100, 'w' => 40, 'h' => 20, 'gaya' => ['ukuran' => 10]],
            ['tipe' => 'halaman_otomatis', 'label' => 'Hal', 'halaman' => 1, 'x' => 20, 'y' => 120, 'w' => 40, 'h' => 6, 'format' => 'Hal {halaman}/{jumlah}', 'gaya' => ['ukuran' => 9]],
        ]], tetapTeks: Storage::disk('local')->path('aset/stempel.png'));

        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertStringContainsString('%%EOF', $pdf);

        // Tanda tangan memang sengaja tidak digambar, jadi hanya lima tipe
        // lain yang menghasilkan kotak.
        // Teks, paragraf, centang, dan nomor halaman menggambar kotak potong.
        // Gambar tidak memakainya, dan tanda tangan memang dilewati, jadi
        // jumlah kotak di sini tepat empat.
        $this->assertCount(4, $this->kotakTeras($pdf), 'Empat tipe berbasis teks harus menggambar kotak.');

        // Gambar disematkan sebagai objek gambar, bukan kotak potong.
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
    private function kotakTeras(string $pdf): array
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

    /** @return list<string> */
    private function aliranIsi(string $pdf): array
    {
        $daftar = [];

        if (preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $pdf, $cocok) === 0) {
            return $daftar;
        }

        foreach ($cocok[1] as $mentah) {
            $isi = @gzuncompress($mentah);

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
}
