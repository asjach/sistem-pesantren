<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\TemplateDokumen;
use App\Services\IzinKatalog;
use App\Services\Template\KatalogNilai;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TemplateDokumenTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
    }

    private function fixture(): void
    {
        Lembaga::create(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true]);
        Lembaga::create(['nama' => 'MA', 'jenjang' => 'MA', 'is_active' => true]);
    }

    private function template(array $atribut = []): TemplateDokumen
    {
        static $urut = 0;
        $urut++;

        return TemplateDokumen::create(array_merge([
            'kode' => 'surat-'.$urut.'-'.uniqid(),
            'nama' => 'Surat '.$urut,
        ], $atribut));
    }

    public function test_izin_template_terdaftar_di_katalog(): void
    {
        foreach (['lihat', 'tambah', 'ubah', 'hapus'] as $aksi) {
            $this->assertTrue(IzinKatalog::dikenal("template_dokumen.{$aksi}"));
        }

        $this->assertDatabaseHas('permissions', ['name' => 'template_dokumen.lihat', 'guard_name' => 'sanctum']);
    }

    public function test_daftar_template_menampilkan_global_dan_milik_lembaga_aktif_saja(): void
    {
        $this->fixture();

        $global = $this->template(['jenjang' => null]);
        $mts = $this->template(['jenjang' => 'MTS']);
        $this->template(['jenjang' => 'MA']);

        $terlihat = TemplateDokumen::tersedia(['MTS'])->pluck('id')->all();

        $this->assertEqualsCanonicalizing([$global->id, $mts->id], $terlihat);
        $this->assertCount(2, $terlihat);
    }

    public function test_daftar_template_tanpa_lembaga_boleh_diakses_hanya_menampilkan_global(): void
    {
        $this->fixture();

        $global = $this->template(['jenjang' => null]);
        $this->template(['jenjang' => 'MTS']);

        // Daftar kosong berarti hanya global, bukan "tampilkan semua".
        $this->assertSame([$global->id], TemplateDokumen::tersedia([])->pluck('id')->all());
    }

    public function test_ukuran_halaman_membulatkan_pelaratan_dari_fpdi(): void
    {
        // FPDI mengembalikan 210.00014444444 karena satuan PDF adalah point;
        // nilai pelarut itu tidak boleh tersimpan apa adanya.
        $template = $this->template([
            'halaman' => [
                ['lebar_mm' => 210.00014444444, 'tinggi_mm' => 297.00008333333],
                ['lebar_mm' => 210.00014444444, 'tinggi_mm' => 330.0],
            ],
            'jumlah_halaman' => 2,
        ]);

        $this->assertSame(['lebar_mm' => 210.0, 'tinggi_mm' => 297.0], $template->ukuranHalaman(1));
        $this->assertSame(['lebar_mm' => 210.0, 'tinggi_mm' => 330.0], $template->ukuranHalaman(2));
    }

    public function test_ukuran_halaman_diluar_rentang_kembali_ke_a4(): void
    {
        $template = $this->template();

        $this->assertSame(['lebar_mm' => 210.0, 'tinggi_mm' => 297.0], $template->ukuranHalaman(1));
        $this->assertSame(['lebar_mm' => 210.0, 'tinggi_mm' => 297.0], $template->ukuranHalaman(9));
    }

    public function test_katalog_nilai_memuat_semua_sumber_dan_koleksi(): void
    {
        $katalog = KatalogNilai::untukFrontend();
        $kunciSumber = array_column($katalog['sumber'], 'kunci');
        $kunciKoleksi = array_column($katalog['koleksi'], 'kunci');

        foreach (['santri', 'keluarga_santri', 'penempatan_santri', 'lembaga', 'pegawai', 'tetap', 'sistem'] as $kunci) {
            $this->assertContains($kunci, $kunciSumber, "sumber {$kunci} hilang");
        }

        foreach (['daftar_santri_kelas', 'nilai_santri', 'presensi_santri'] as $kunci) {
            $this->assertContains($kunci, $kunciKoleksi, "koleksi {$kunci} hilang");
        }
    }

    public function test_setiap_medan_katalog_punya_tipe_dan_contoh_yang_valid(): void
    {
        $katalog = KatalogNilai::untukFrontend();
        $semua = array_merge($katalog['sumber'], $katalog['koleksi']);

        foreach ($semua as $sumber) {
            $this->assertNotEmpty($sumber['medan'], "{$sumber['kunci']} tidak punya medan");

            foreach ($sumber['medan'] as $medan) {
                $this->assertContains($medan['tipe'], KatalogNilai::TIPE, "tipe tidak dikenal pada {$sumber['kunci']}.{$medan['kunci']}");
                $this->assertNotSame('', trim((string) $medan['label']));

                if ($medan['tipe'] === 'gambar') {
                    continue;
                }

                $this->assertNotNull($medan['contoh'], "medan {$sumber['kunci']}.{$medan['kunci']} tidak punya nilai contoh");
            }
        }
    }

    public function test_kunci_medan_unik_dalam_satu_sumber(): void
    {
        foreach (array_merge(KatalogNilai::sumber(), KatalogNilai::koleksi()) as $kunci => $definisi) {
            $daftar = array_column($definisi['medan'], 'kunci');

            $this->assertSame($daftar, array_unique($daftar), "kunci medan ganda pada sumber {$kunci}");
        }
    }

    public function test_hanya_sumber_tanpa_pilih_data_yang_tidak_butuh_pemilihan_data(): void
    {
        $katalog = KatalogNilai::untukFrontend();

        foreach ($katalog['sumber'] as $sumber) {
            $bolehKosong = in_array($sumber['kunci'], ['tetap', 'sistem'], true);

            if ($bolehKosong) {
                $this->assertNull($sumber['pilih_data'], "{$sumber['kunci']} seharusnya tidak memilih data");
            } else {
                $this->assertNotNull($sumber['pilih_data'], "{$sumber['kunci']} harus menunjuk data yang dipilih");
            }
        }
    }
}
