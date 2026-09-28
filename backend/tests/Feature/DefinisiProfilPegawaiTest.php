<?php

namespace Tests\Feature;

use App\Models\TemplateDokumen;
use App\Services\Template\DefinisiMedan;
use App\Services\Template\DefinisiProfilPegawai;
use App\Services\Template\KatalogNilai;
use App\Services\Template\KonteksCetak;
use App\Services\Template\PencetakMedan;
use App\Services\Template\PengisiNilai;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DefinisiProfilPegawaiTest extends TestCase
{
    use RefreshDatabase;

    /** @return list<array<string, mixed>> */
    private function medan(): array
    {
        return DefinisiProfilPegawai::definisi()['medan'];
    }

    public function test_kode_dan_nama_tidak_berubah_antar_acuan(): void
    {
        $this->assertSame('profil-pegawai', DefinisiProfilPegawai::KODE);
        $this->assertNotSame('', DefinisiProfilPegawai::NAMA);
    }

    public function test_ukuran_halaman_a4_dua_halaman(): void
    {
        $ukuran = DefinisiProfilPegawai::ukuranHalaman();

        $this->assertSame(210.0, $ukuran['lebar_mm']);
        $this->assertSame(297.0, $ukuran['tinggi_mm']);
        $this->assertSame(2, DefinisiProfilPegawai::JUMLAH_HALAMAN);
    }

    public function test_setiap_medan_lolos_validasi_definisi(): void
    {
        foreach ($this->medan() as $medan) {
            $this->assertIsArray(DefinisiMedan::normalisasi($medan, DefinisiProfilPegawai::JUMLAH_HALAMAN));
        }
    }

    public function test_semua_medan_dalam_batas_halaman(): void
    {
        $ukuran = DefinisiProfilPegawai::ukuranHalaman();

        foreach ($this->medan() as $medan) {
            $halaman = (int) $medan['halaman'];

            $this->assertGreaterThanOrEqual(1, $halaman);
            $this->assertLessThanOrEqual(DefinisiProfilPegawai::JUMLAH_HALAMAN, $halaman);
            $this->assertGreaterThanOrEqual(0, (float) $medan['x'], 'x terlalu kiri');
            $this->assertGreaterThanOrEqual(0, (float) $medan['y'], 'y terlalu atas');
            $this->assertLessThanOrEqual($ukuran['lebar_mm'], (float) $medan['x'] + (float) $medan['w'], 'melebar kanan');
            $this->assertLessThanOrEqual($ukuran['tinggi_mm'], (float) $medan['y'] + (float) $medan['h'], 'meluber bawah');
        }
    }

    public function test_tidak_ada_medan_bertumpuk_dalam_halaman_yang_sama(): void
    {
        $medan = $this->medan();

        for ($a = 0; $a < count($medan); $a++) {
            for ($b = $a + 1; $b < count($medan); $b++) {
                $satu = $medan[$a];
                $dua = $medan[$b];

                if ((int) $satu['halaman'] !== (int) $dua['halaman']) {
                    continue;
                }

                // 'kotak' adalah lapisan latar; teks sengaja diletakkan di atasnya.
                if ($satu['tipe'] === 'kotak' || $dua['tipe'] === 'kotak') {
                    continue;
                }

                $tumpang = (float) $satu['x'] < (float) $dua['x'] + (float) $dua['w']
                    && (float) $dua['x'] < (float) $satu['x'] + (float) $satu['w']
                    && (float) $satu['y'] < (float) $dua['y'] + (float) $dua['h']
                    && (float) $dua['y'] < (float) $satu['y'] + (float) $satu['h'];

                $this->assertFalse(
                    $tumpang,
                    sprintf('"%s" bertumpuk dengan "%s" di halaman %d', $satu['label'], $dua['label'], $satu['halaman']),
                );
            }
        }
    }

    public function test_halaman_pertama_memuat_kop_dan_blok_identitas(): void
    {
        $pertama = array_values(array_filter($this->medan(), fn (array $m): bool => (int) $m['halaman'] === 1));

        $statis = array_column($pertama, 'teks_tetap');

        $this->assertContains('PROFIL PEGAWAI', $statis);
        $this->assertContains('Identitas diri', $statis);
        $this->assertContains('Domisili & kontak', $statis);
        $this->assertContains('Kepegawaian', $statis);
    }

    public function test_halaman_kedua_memuat_tiga_tabel_dengan_kepala_kolom(): void
    {
        $kedua = array_values(array_filter($this->medan(), fn (array $m): bool => (int) $m['halaman'] === 2));

        $koleksi = array_values(array_map(
            fn (array $m): string => $m['baris_berulang']['sumber'],
            array_filter($kedua, fn (array $m): bool => $m['tipe'] === 'baris_berulang'),
        ));

        $this->assertSame(
            ['penempatan_pegawai', 'keaktifan_pegawai_riwayat', 'akun_pegawai'],
            $koleksi,
        );

        $kepala = array_column($kedua, 'teks_tetap');

        $this->assertContains('Penempatan lembaga', $kepala);
        $this->assertContains('Keaktifan per tahun ajaran', $kepala);
        $this->assertContains('Akun login tertaut', $kepala);
    }

    public function test_kunci_kolom_tabel_ada_di_katalog_koleksi(): void
    {
        $katalog = KatalogNilai::koleksi();

        foreach ($this->medan() as $medan) {
            if ($medan['tipe'] !== 'baris_berulang') {
                continue;
            }

            $bagian = $medan['baris_berulang'];
            $kunciKoleksi = $bagian['sumber'];
            $kunciTersedia = array_column($katalog[$kunciKoleksi]['medan'], 'kunci');

            foreach ($bagian['kolom'] as $kolom) {
                $this->assertContains(
                    $kolom['kunci'],
                    $kunciTersedia,
                    sprintf('kunci kolom "%s" tidak ada di katalog "%s"', $kolom['kunci'], $kunciKoleksi),
                );
                $this->assertNotSame('', $kolom['label'], 'kepala kolom wajib punya label tampilan');
            }
        }
    }

    public function test_kolom_tabel_tidak_meluber_dan_tidak_saling_tindih(): void
    {
        foreach ($this->medan() as $medan) {
            if ($medan['tipe'] !== 'baris_berulang') {
                continue;
            }

            $kolom = $medan['baris_berulang']['kolom'];
            $sebelumnya = null;

            foreach ($kolom as $satu) {
                $this->assertGreaterThan(0.0, (float) $satu['w']);

                if ($sebelumnya !== null) {
                    $this->assertGreaterThanOrEqual(
                        (float) $sebelumnya,
                        (float) $satu['x'],
                        'kolom tabel harus berurutan tanpa tumpang tindih',
                    );
                }

                $sebelumnya = (float) $satu['x'] + (float) $satu['w'];
            }

            $this->assertLessThanOrEqual((float) $medan['w'], $sebelumnya);
        }
    }

    public function test_konteks_memetakan_pilihan_data_ke_id_yang_tepat(): void
    {
        $konteks = new KonteksCetak(jenjang: 'MTS', idSantri: 7, idPegawai: 9, idPsbCalon: 11);

        $this->assertSame(7, $konteks->idUntuk('santri'));
        $this->assertSame(9, $konteks->idUntuk('pegawai'));
        $this->assertSame(11, $konteks->idUntuk('calon_psb'));
        $this->assertNull($konteks->idUntuk(null));
        $this->assertNull($konteks->idUntuk('tidak_dikenal'));
    }

    public function test_katalog_menandai_koleksi_pegawai_dengan_pilih_data(): void
    {
        foreach (['penempatan_pegawai', 'keaktifan_pegawai_riwayat', 'akun_pegawai'] as $kunci) {
            $this->assertSame('pegawai', KatalogNilai::koleksi()[$kunci]['pilih_data'] ?? null);
        }

        foreach (['daftar_santri_kelas', 'nilai_santri', 'presensi_santri'] as $kunci) {
            $this->assertSame('santri', KatalogNilai::koleksi()[$kunci]['pilih_data'] ?? null);
        }
    }

    public function test_seluruh_kunci_yang_dirujuk_ada_di_katalog(): void
    {
        $sumber = KatalogNilai::sumber();

        foreach ($this->medan() as $medan) {
            $nama = $medan['sumber'] ?? null;

            if ($nama === null || $nama === 'tetap') {
                continue;
            }

            if ($nama === 'baris_berulang') {
                continue;
            }

            if ($nama === 'sistem') {
                continue;
            }

            $this->assertArrayHasKey($nama, $sumber, sprintf('sumber "%s" tidak dikenal', $nama));
            $this->assertContains($medan['kunci'], array_column($sumber[$nama]['medan'], 'kunci'));
        }
    }

    public function test_medan_tanpa_kunci_harus_memakai_teks_tetap(): void
    {
        foreach ($this->medan() as $medan) {
            if (($medan['tipe'] ?? null) !== 'teks' || ($medan['kunci'] ?? null) !== null) {
                continue;
            }

            $this->assertNotSame(
                '',
                (string) ($medan['teks_tetap'] ?? ''),
                sprintf('medan "%s" tanpa kunci harus punya teks statis', $medan['label']),
            );
        }
    }

    public function test_teks_statis_dipakai_apa_adanya_oleh_pencetak(): void
    {
        $konteks = new KonteksCetak(jenjang: 'MTS');
        $pengisi = new PengisiNilai($konteks);
        $templat = TemplateDokumen::create([
            'kode' => 'profil-pegawai',
            'nama' => 'Profil Pegawai',
            'jenis' => 'html',
        ]);

        $pencetak = new class($templat, $pengisi, $konteks) extends PencetakMedan
        {
            public function hasil(): string
            {
                return '';
            }

            /** @param  array<string, mixed>  $medan */
            public function teksMedan(array $medan): string
            {
                return $this->teks($medan);
            }
        };

        $this->assertSame('PROFIL PEGAWAI', $pencetak->teksMedan([
            'tipe' => 'teks',
            'label' => 'Judul',
            'sumber' => 'tetap',
            'kunci' => null,
            'teks_tetap' => 'PROFIL PEGAWAI',
            'gaya' => [],
        ]));

        $this->assertSame('', $pencetak->teksMedan([
            'tipe' => 'teks',
            'label' => 'Tanpa teks',
            'sumber' => 'tetap',
            'kunci' => null,
            'teks_tetap' => null,
            'gaya' => [],
        ]));
    }

    public function test_koleksi_pegawai_mengambil_id_pegawai_bukan_id_santri(): void
    {
        $pengisi = new PengisiNilai(new KonteksCetak(jenjang: 'MTS', idSantri: 7, idPegawai: 9));

        $tanpaKonteks = $pengisi->koleksi('akun_pegawai', null);

        $this->assertSame([], $tanpaKonteks, 'tanpa id pegawai tidak boleh ikut memakai id santri');
    }
}
