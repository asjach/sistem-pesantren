<?php

namespace Tests\Feature;

use App\Services\Template\DefinisiMedan;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DefinisiMedanTest extends TestCase
{
    public function test_normalisasi_mengisi_nilai_bawaan_dan_membuang_tipe_asing(): void
    {
        $hasil = DefinisiMedan::normalisasi([
            'medan' => [
                ['tipe' => 'teks', 'label' => 'Nama', 'sumber' => 'santri', 'kunci' => 'nama_lengkap', 'x' => 20, 'y' => 45, 'w' => 170, 'h' => 8],
                ['tipe' => 'tidak-ada', 'label' => 'Buang saya'],
            ],
        ], 1);

        $this->assertSame(1, count($hasil['medan']));
        $this->assertSame(1, $hasil['versi']);

        $medan = $hasil['medan'][0];
        $this->assertSame('m1', $medan['id']);
        $this->assertSame(1, $medan['halaman']);
        $this->assertSame('helvetica', $medan['gaya']['font']);
        $this->assertSame(11.0, $medan['gaya']['ukuran']);
        $this->assertSame('#000000', $medan['gaya']['warna']);
        $this->assertSame('kiri', $medan['gaya']['rata']);
        $this->assertTrue($medan['gaya']['skala_otomatis']);
    }

    public function test_nilai_kotak_dibatasi_tidak_meloloskan_angka_aneh(): void
    {
        $hasil = DefinisiMedan::normalisasi([
            'medan' => [
                ['tipe' => 'teks', 'label' => 'X', 'x' => -50, 'y' => 99999, 'w' => 0, 'h' => 10 ** 9],
            ],
        ], 1);

        $medan = $hasil['medan'][0];
        $this->assertSame(0.0, $medan['x']);
        $this->assertSame(2000.0, $medan['y']);
        $this->assertSame(1.0, $medan['w'], 'lebar minimum 1 mm agar kotak tetap punya isi');
        $this->assertSame(2000.0, $medan['h']);
    }

    public function test_halaman_dibatasi_ke_jumlah_halaman_berkas(): void
    {
        $hasil = DefinisiMedan::normalisasi([
            'medan' => [
                ['tipe' => 'teks', 'label' => 'A', 'halaman' => 99],
                ['tipe' => 'teks', 'label' => 'B', 'halaman' => 0],
            ],
        ], 3);

        $this->assertSame(3, $hasil['medan'][0]['halaman']);
        $this->assertSame(1, $hasil['medan'][1]['halaman']);
    }

    public function test_gambar_dapat_sizemode_dan_centang_dapat_huruf_bawaan(): void
    {
        $hasil = DefinisiMedan::normalisasi([
            'medan' => [
                ['tipe' => 'gambar', 'label' => 'Foto', 'sumber' => 'santri', 'kunci' => 'foto', 'sizemode' => 'potong'],
                ['tipe' => 'gambar', 'label' => 'Logo', 'sizemode' => 'ngawur'],
                ['tipe' => 'centang', 'label' => 'Laki-laki', 'sumber' => 'santri', 'kunci' => 'jk', 'bawa' => 'L'],
            ],
        ], 1);

        $this->assertSame('potong', $hasil['medan'][0]['sizemode']);
        $this->assertSame('sesuaikan', $hasil['medan'][1]['sizemode'], 'sizemode asing jatuh ke bawaan');
        $this->assertSame('L', $hasil['medan'][2]['bawa']);
        $this->assertSame('✓', $hasil['medan'][2]['huruf']);
        $this->assertSame('', $hasil['medan'][2]['huruf_kosong']);
    }

    public function test_baris_berulang_mendapat_bawaan_kolom_dan_batas(): void
    {
        $hasil = DefinisiMedan::normalisasi([
            'medan' => [
                ['tipe' => 'baris_berulang', 'label' => 'Nilai', 'x' => 20, 'y' => 80, 'w' => 170, 'h' => 60, 'baris_berulang' => [
                    'sumber' => 'nilai_santri', 'tinggi_baris' => 7.5,
                    'kolom' => [
                        ['label' => 'No', 'w' => 10, 'sumber' => 'tetap', 'kunci' => 'no_urut'],
                        ['label' => 'Mapel', 'w' => 100, 'sumber' => 'baris', 'kunci' => 'mata_pelajaran'],
                    ],
                ]],
            ],
        ], 1);

        $baris = $hasil['medan'][0]['baris_berulang'];
        $this->assertSame('nilai_santri', $baris['sumber']);
        $this->assertSame(10, $baris['jumlah'], 'jumlah baris bawaan 10');
        $this->assertSame(7.5, $baris['tinggi_baris']);
        $this->assertCount(2, $baris['kolom']);
        $this->assertSame('helvetica', $baris['kolom'][0]['gaya']['font']);
    }

    public function test_baris_berulang_membatasi_jumlah_baris_dan_kolom(): void
    {
        $kolom = array_fill(0, 40, ['label' => 'X', 'w' => 5]);
        $hasil = DefinisiMedan::normalisasi([
            'medan' => [
                ['tipe' => 'baris_berulang', 'label' => 'X', 'baris_berulang' => ['sumber' => 'nilai_santri', 'jumlah' => 5000, 'kolom' => $kolom]],
            ],
        ], 1);

        $baris = $hasil['medan'][0]['baris_berulang'];
        $this->assertSame(DefinisiMedan::BATAS_BARIS, $baris['jumlah']);
        $this->assertCount(DefinisiMedan::BATAS_KOLOM, $baris['kolom']);
    }

    public function test_jumlah_medan_dibatasi(): void
    {
        $medan = array_fill(0, 200, ['tipe' => 'teks', 'label' => 'X', 'w' => 10, 'h' => 5]);
        $hasil = DefinisiMedan::normalisasi(['medan' => $medan], 1);

        $this->assertCount(DefinisiMedan::BATAS_MEDAN, $hasil['medan']);
    }

    public function test_halaman_otomatis_mendapat_format_bawaan(): void
    {
        $hasil = DefinisiMedan::normalisasi([
            'medan' => [['tipe' => 'halaman_otomatis', 'label' => 'Footer', 'x' => 80, 'y' => 285, 'w' => 50, 'h' => 5]],
        ], 1);

        $this->assertSame('Halaman {halaman} dari {jumlah}', $hasil['medan'][0]['format']);
    }

    public function test_validasi_menolak_halaman_di_luar_jangkauan(): void
    {
        $this->expectException(ValidationException::class);

        DefinisiMedan::validasi([
            'medan' => [['tipe' => 'teks', 'label' => 'X', 'halaman' => 4, 'x' => 1, 'y' => 1, 'w' => 10, 'h' => 5]],
        ], 2);
    }

    public function test_validasi_menolak_tipe_tidak_dikenal(): void
    {
        $this->expectException(ValidationException::class);

        DefinisiMedan::validasi([
            'medan' => [['tipe' => 'watermark', 'label' => 'X', 'halaman' => 1, 'x' => 1, 'y' => 1, 'w' => 10, 'h' => 5]],
        ], 1);
    }

    public function test_validasi_menolak_warna_bukan_hex(): void
    {
        $this->expectException(ValidationException::class);

        DefinisiMedan::validasi([
            'medan' => [[
                'tipe' => 'teks', 'label' => 'X', 'halaman' => 1, 'x' => 1, 'y' => 1, 'w' => 10, 'h' => 5,
                'gaya' => ['warna' => 'merah'],
            ]],
        ], 1);
    }

    public function test_validasi_menolak_font_tidak_tersedia(): void
    {
        $this->expectException(ValidationException::class);

        DefinisiMedan::validasi([
            'medan' => [[
                'tipe' => 'teks', 'label' => 'X', 'halaman' => 1, 'x' => 1, 'y' => 1, 'w' => 10, 'h' => 5,
                'gaya' => ['font' => 'comic-sans'],
            ]],
        ], 1);
    }

    public function test_validasi_menolak_koleksi_tidak_dikenal_pada_baris_berulang(): void
    {
        $this->expectException(ValidationException::class);

        DefinisiMedan::validasi([
            'medan' => [[
                'tipe' => 'baris_berulang', 'label' => 'X', 'halaman' => 1, 'x' => 1, 'y' => 1, 'w' => 10, 'h' => 5,
                'baris_berulang' => ['sumber' => 'entah', 'jumlah' => 5, 'kolom' => [['w' => 10]]],
            ]],
        ], 1);
    }

    public function test_validasi_menolak_baris_berulang_tanpa_kolom(): void
    {
        $this->expectException(ValidationException::class);

        DefinisiMedan::validasi([
            'medan' => [[
                'tipe' => 'baris_berulang', 'label' => 'X', 'halaman' => 1, 'x' => 1, 'y' => 1, 'w' => 10, 'h' => 5,
                'baris_berulang' => ['sumber' => 'nilai_santri', 'jumlah' => 5, 'kolom' => []],
            ]],
        ], 1);
    }

    public function test_validasi_menerima_bentuk_lengkap_yang_sah(): void
    {
        DefinisiMedan::validasi([
            'medan' => [
                ['tipe' => 'teks', 'label' => 'Nama', 'halaman' => 1, 'x' => 20, 'y' => 45, 'w' => 170, 'h' => 8,
                    'sumber' => 'santri', 'kunci' => 'nama_lengkap',
                    'gaya' => ['font' => 'dejavusans', 'ukuran' => 12, 'warna' => '#1A2B3C', 'rata' => 'tengah']],
                ['tipe' => 'tanda_tangan', 'label' => 'TT', 'halaman' => 1, 'x' => 140, 'y' => 240, 'w' => 40, 'h' => 20],
            ],
        ], 2);

        $this->assertTrue(true, 'tidak melempar exception');
    }

    public function test_tanda_tangan_tidak_butuh_nilai(): void
    {
        $hasil = DefinisiMedan::normalisasi([
            'medan' => [['tipe' => 'tanda_tangan', 'label' => 'TT', 'w' => 40, 'h' => 20]],
        ], 1);

        $this->assertFalse(DefinisiMedan::butuhNilai($hasil['medan'][0]));
        $this->assertTrue(DefinisiMedan::butuhNilai(DefinisiMedan::normalisasi([
            'medan' => [['tipe' => 'teks', 'label' => 'X', 'w' => 10, 'h' => 5]],
        ], 1)['medan'][0]));
    }
}
