<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\PsbCalonSantri;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Services\Template\KatalogNilai;
use App\Services\Template\KonteksCetak;
use App\Services\Template\PengisiNilai;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PengisiNilaiTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        Storage::fake('local');

        $lembaga = Lembaga::create([
            'nama' => 'Pondasi WLAN 2', 'nama_singkat' => 'PW2', 'jenjang' => 'MTS',
            'npsn' => '2112345', 'nsm' => '11223456789012', 'akreditasi' => 'A',
            'mudir_am' => 'Drs. H. Ahmad Fauzi', 'alamat' => 'Jl. Raya Cicadas No. 45',
            'kecamatan' => 'Cibeunying Kidul', 'kab_kota' => 'Kab. Bandung',
            'kode_pos' => '40121', 'telepon' => '022-8765432', 'is_active' => true,
        ]);

        $tahunAjaran = TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);
        $kelas = Kelas::create([
            'jenjang' => 'MTS', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '7A', 'tingkat' => 'VII',
        ]);

        $santri = Santri::create([
            'nama_lengkap' => 'Ahmad Fauzi bin Abdul', 'jk' => 'L', 'nik' => '3201234567890123',
            'nisn' => '0081234567', 'tmp_lahir' => 'Bandung', 'tgl_lahir' => '2012-05-17',
            'tipe_santri' => 'asrama', 'agama' => 'Islam', 'bahasa_sehari' => 'Indonesia',
            'alamat' => 'Jl. Cendana No. 12', 'rt' => '1', 'rw' => '2',
            'desa_kelurahan' => 'Sukamaju', 'kecamatan' => 'Cileunyi', 'kab_kota' => 'Kab. Bandung',
            'kode_pos' => '40123', 'ayah_nama' => 'Bapak Ahmad', 'ayah_alamat' => 'Jl. Mawar No. 3',
            'ayah_telp' => '081234567890', 'ibu_nama' => 'Ibu Siti',
        ]);

        $lembagaSantri = LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MTS', 'nis_lokal' => '2026-0012', 'no_urut' => '12',
            'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);

        $riwayat = $santri->riwayatBelajar()->create([
            'tahun_ajaran' => '2026/2027', 'jenjang' => 'MTS', 'kelas_id' => $kelas->id,
            'semester' => '1', 'no_absen' => 7, 'is_active_riwayat' => 'Ya',
        ]);

        $kedua = Santri::create([
            'nama_lengkap' => 'Budi Santoso', 'jk' => 'P', 'tipe_santri' => 'non_asrama',
        ]);
        $kedua->riwayatBelajar()->create([
            'tahun_ajaran' => '2026/2027', 'jenjang' => 'MTS', 'kelas_id' => $kelas->id,
            'semester' => '1', 'no_absen' => 3, 'is_active_riwayat' => 'Ya',
        ]);
        $kedua->lembagaSantri()->create(['jenjang' => 'MTS', 'nis_lokal' => '2026-0003', 'is_active_lembaga' => 'Ya']);

        return compact('lembaga', 'tahunAjaran', 'kelas', 'santri', 'lembagaSantri', 'riwayat', 'kedua');
    }

    private function konteks(array $isi = []): KonteksCetak
    {
        return new KonteksCetak(
            jenjang: 'MTS',
            tahunAjaran: '2026/2027',
            semester: '1',
            kelasId: $isi['kelas_id'] ?? null,
            pencetak: $isi['pencetak'] ?? null,
            tetap: $isi['tetap'] ?? [],
            tanggalAbsen: $isi['tanggal_absen'] ?? null,
        );
    }

    public function test_santri_mengambil_kolom_lengkap_dan_bentuk_turunan(): void
    {
        $f = $this->fixture();
        $nilai = (new PengisiNilai($this->konteks()))->untuk('santri', $f['santri']->id);

        $this->assertSame('Ahmad Fauzi bin Abdul', $nilai['nama_lengkap']);
        $this->assertSame('0081234567', $nilai['nisn']);
        $this->assertSame('L', $nilai['jk_tercantum']);
        $this->assertSame('Asrama', $nilai['tipe_santri_tercantum']);
        $this->assertSame('17 Mei 2012 (14 tahun)', $nilai['tgl_lahir_umur']);
        $this->assertSame(
            'Jl. Cendana No. 12, RT 001 / RW 002, Sukamaju, Cileunyi, Kab. Bandung, 40123',
            $nilai['alamat_lengkap'],
        );
    }

    public function test_setiap_medan_santri_selalu_punya_kunci(): void
    {
        $f = $this->fixture();
        $nilai = (new PengisiNilai($this->konteks()))->untuk('santri', $f['santri']->id);

        $this->assertSame(
            array_column(KatalogNilai::sumber()['santri']['medan'], 'kunci'),
            array_keys($nilai),
        );
    }

    public function test_santri_kosong_tidak_melempar_dan_menghasilkan_null(): void
    {
        $nilai = (new PengisiNilai($this->konteks()))->untuk('santri', 999999);

        $this->assertSame([], array_filter($nilai, fn ($v) => $v !== null));
        $this->assertArrayHasKey('nama_lengkap', $nilai);
    }

    public function test_keluarga_menyusun_alamat_orang_tua_dari_alamat_ayah(): void
    {
        $f = $this->fixture();
        $nilai = (new PengisiNilai($this->konteks()))->untuk('keluarga_santri', $f['santri']->id);

        $this->assertSame('Bapak Ahmad', $nilai['ayah_nama']);
        $this->assertSame('Ibu Siti', $nilai['ibu_nama']);
        $this->assertSame('081234567890', $nilai['ayah_telp']);
        // RT/RW milik Santri tidak ikut dipinjam ke alamat orang tua.
        $this->assertSame(
            'Jl. Mawar No. 3, Sukamaju, Cileunyi, Kab. Bandung, 40123',
            $nilai['alamat_ortu'],
        );
    }

    public function test_penempatan_santri_mengikuti_tahun_ajaran_dan_konteks(): void
    {
        $f = $this->fixture();
        $nilai = (new PengisiNilai($this->konteks()))->untuk('penempatan_santri', $f['santri']->id);

        $this->assertSame('2026-0012', $nilai['nis_lokal']);
        $this->assertSame('7A', $nilai['nama_kelas']);
        $this->assertSame('VII', $nilai['tingkat']);
        $this->assertSame('Kelas VII 7A', $nilai['kelas_lengkap']);
        $this->assertSame(7, $nilai['no_absen']);
        $this->assertSame('Ganjil', $nilai['semester']);
    }

    public function test_lembaga_mengikuti_lembaga_aktif_dan_menyusun_alamat(): void
    {
        $this->fixture();
        $nilai = (new PengisiNilai($this->konteks()))->untuk('lembaga');

        $this->assertSame('Pondasi WLAN 2', $nilai['nama']);
        $this->assertSame('A', $nilai['akreditasi']);
        $this->assertSame(
            'Jl. Raya Cicadas No. 45, Cibeunying Kidul, Kab. Bandung, 40121',
            $nilai['alamat_lengkap'],
        );
    }

    public function test_psb_calon_mengambil_data_pendaftar(): void
    {
        $this->fixture();
        $calon = PsbCalonSantri::create([
            'jenjang' => 'MTS', 'no_pendaftaran' => 'PSB-2026-000123', 'nik' => '3201234567890124',
            'nama_lengkap' => 'Siti Aminah', 'jk' => 'P', 'tanggal_daftar' => '2026-06-15',
            'status_pendaftaran' => 'Diterima',
        ]);

        $nilai = (new PengisiNilai($this->konteks()))->untuk('psb_calon', $calon->id);

        $this->assertSame('PSB-2026-000123', $nilai['no_pendaftaran']);
        $this->assertSame('Diterima', $nilai['status_pendaftaran']);
    }

    public function test_nilai_tetap_dan_sistem_baca_dari_konteks(): void
    {
        $this->fixture();
        $user = User::create(['name' => 'Operator TU', 'email' => 'tu-'.uniqid().'@example.com', 'password' => 'x']);
        $pengisi = new PengisiNilai($this->konteks(['pencetak' => $user, 'tetap' => ['teks' => '123/MTS/2026']]));

        $tetap = $pengisi->untuk('tetap');
        $sistem = $pengisi->untuk('sistem');

        $this->assertSame('123/MTS/2026', $tetap['teks']);
        $this->assertSame('Operator TU', $sistem['pencetak']);
        $this->assertSame(now()->format('Y-m-d'), $sistem['tanggal_hari_ini']);
    }

    public function test_daftar_santri_kelas_urut_absen_dan_menomborkan_baris(): void
    {
        $f = $this->fixture();
        $baris = (new PengisiNilai($this->konteks(['kelas_id' => $f['kelas']->id])))
            ->koleksi('daftar_santri_kelas');

        $this->assertCount(2, $baris);
        $this->assertSame(1, $baris[0]['no_urut']);
        $this->assertSame(2, $baris[1]['no_urut']);
        $this->assertSame('Budi Santoso', $baris[0]['nama_lengkap'], 'kelas terurut dari no_absen terkecil');
        $this->assertSame('Ahmad Fauzi bin Abdul', $baris[1]['nama_lengkap']);
    }

    public function test_daftar_santri_kelas_tanpa_kelas_aktif_kosong(): void
    {
        $this->fixture();

        $this->assertSame([], (new PengisiNilai($this->konteks()))->koleksi('daftar_santri_kelas'));
    }

    public function test_kolom_hadir_kosong_bila_belum_ada_catatan_presensi(): void
    {
        $f = $this->fixture();
        $baris = (new PengisiNilai($this->konteks([
            'kelas_id' => $f['kelas']->id,
            'tanggal_absen' => '2026-09-01',
        ])))->koleksi('daftar_santri_kelas');

        // Tidak boleh diasumsikan hadir: dokumen resmi tidak boleh mengarang.
        $this->assertNull($baris[0]['hadir']);
    }

    public function test_kolom_hadir_mengikuti_presensi_pada_tanggal_terpilih(): void
    {
        $f = $this->fixture();

        $sesi = DB::table('sesi_presensi')->insertGetId([
            'nama_sesi' => 'KBM Pagi', 'kategori' => 'kbm',
        ]);

        DB::table('presensi_santri')->insert([
            'santri_id' => $f['kedua']->id, 'kelas_id' => $f['kelas']->id,
            'sesi_presensi_id' => $sesi, 'tanggal' => '2026-09-01', 'status' => 'sakit',
        ]);

        $baris = (new PengisiNilai($this->konteks([
            'kelas_id' => $f['kelas']->id,
            'tanggal_absen' => '2026-09-01',
        ])))->koleksi('daftar_santri_kelas');

        $this->assertSame('sakit', $baris[0]['hadir']);
        $this->assertNull($baris[1]['hadir']);
    }

    public function test_koleksi_nilai_santri_mengikuti_tahun_ajaran_dan_semester(): void
    {
        $f = $this->fixture();

        $mapel = DB::table('mata_pelajaran')->insertGetId(['jenjang' => 'MTS', 'nama_mapel' => 'Matematika']);
        $pengampu = DB::table('pengampu_mapel')->insertGetId(['kelas_id' => $f['kelas']->id, 'mata_pelajaran_id' => $mapel]);

        DB::table('nilai_santri')->insert([
            'santri_id' => $f['santri']->id, 'pengampu_mapel_id' => $pengampu,
            'tahun_ajaran' => '2026/2027', 'semester' => '1',
            'nilai_formatif' => 82.5, 'nilai_sumatif' => 84.0, 'nilai_akhir' => 83.4, 'predikat' => 'B',
        ]);

        $baris = (new PengisiNilai($this->konteks()))->koleksi('nilai_santri', $f['santri']->id);

        $this->assertCount(1, $baris);
        $this->assertSame(1, $baris[0]['no_urut']);
        $this->assertSame('Matematika', $baris[0]['mata_pelajaran']);
        $this->assertSame('B', $baris[0]['predikat']);
        $this->assertEquals(83.4, $baris[0]['nilai_akhir']);
    }

    public function test_koleksi_tanpa_santri_dipilih_menghasilkan_kosong(): void
    {
        $this->fixture();
        $pengisi = new PengisiNilai($this->konteks());

        foreach (['nilai_santri', 'presensi_santri', 'pelanggaran_santri'] as $kunci) {
            $this->assertSame([], $pengisi->koleksi($kunci), "koleksi {$kunci} seharusnya kosong");
        }
    }

    public function test_medan_gambar_mengembalikan_path_lokal_yang_ada(): void
    {
        $f = $this->fixture();
        Storage::disk('local')->put('santri/foto/abc.png', 'gambar-uji');

        $santri = Santri::find($f['santri']->id);
        $santri->foto_url = 'santri/foto/abc.png';
        $santri->save();

        $nilai = (new PengisiNilai($this->konteks()))->untuk('santri', $santri->id);

        $this->assertStringEndsWith('santri/foto/abc.png', (string) $nilai['foto']);
    }

    public function test_medan_gambar_mengabaikan_path_alam(): void
    {
        $f = $this->fixture();
        $santri = Santri::find($f['santri']->id);
        $santri->foto_url = 'santri/foto/tidak-ada.png';
        $santri->save();

        $nilai = (new PengisiNilai($this->konteks()))->untuk('santri', $santri->id);

        $this->assertNull($nilai['foto']);
    }
}
