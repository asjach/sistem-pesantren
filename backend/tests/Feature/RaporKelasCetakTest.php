<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MataPelajaran;
use App\Models\NilaiSantri;
use App\Models\Pegawai;
use App\Models\PengampuMapel;
use App\Models\PeristiwaNilai;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Cetak massal satu kelas: peringkat per batch dan snapshot penanda tangan. */
class RaporKelasCetakTest extends TestCase
{
    use RefreshDatabase;

    private const TA = '2026/2027';

    private User $admin;

    private Lembaga $lembaga;

    private Kelas $kelas;

    private PeristiwaNilai $asas;

    private PengampuMapel $pengampu;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        $this->lembaga = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'is_seleksi' => false,
            'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $this->admin = User::create([
            'name' => 'Admin Rapor', 'email' => 'admin-rapor@example.com',
            'phone' => '081222222222', 'password' => 'password',
        ]);
        $this->admin->assignRole('super_admin');

        $this->kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '6A', 'tingkat' => '6',
        ]);
        $mapel = MataPelajaran::create(['jenjang' => 'MI', 'nama_mapel' => 'Fiqih', 'kelompok' => 'formal']);
        $this->pengampu = PengampuMapel::create(['kelas_id' => $this->kelas->id, 'mata_pelajaran_id' => $mapel->id]);
        $this->asas = PeristiwaNilai::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'kode' => 'ASAS',
            'nama' => 'Asesmen Sumatif Akhir Semester', 'cakupan' => 'semua',
            'kurikulum' => 'keduanya', 'jenis_rapor' => 'akhir', 'urutan' => 1, 'is_active' => true,
        ]);
    }

    public function test_cetak_massal_mengembalikan_seluruh_kelas_dengan_peringkat_satu_batch(): void
    {
        $this->santri('Ahmad', '26001', 90);
        $this->santri('Bilal', '26002', 80);
        $this->santri('Cahya', '26003', 70);
        $this->santri('Daud', '26004', 60);
        $this->pasangPenandatangan('Siti Aminah', 'Kepala Madrasah');

        $respons = $this->cetak('3')->assertOk()->json();

        $this->assertSame('3', $respons['peringkat']);
        $this->assertCount(4, $respons['rapor']);
        $this->assertSame('Ibu Usth. Siti Aminah, S.Pd.', $respons['penandatangan']['wali_kelas']);
        $this->assertSame('Kepala Madrasah', $respons['penandatangan']['kepala']);

        foreach (['Ahmad' => 1, 'Bilal' => 2, 'Cahya' => 3] as $nama => $peringkat) {
            $baris = $this->cariRapor($respons['rapor'], $nama);
            $this->assertSame($peringkat, $baris['rekap']['peringkat']);
            $this->assertSame(4, $baris['rekap']['peringkat_total']);
        }
        $daud = $this->cariRapor($respons['rapor'], 'Daud');
        $this->assertNull($daud['rekap']['peringkat']);
        $this->assertSame(4, $daud['rekap']['peringkat_total']);

        $this->assertDatabaseHas('batch_cetak_rapor', [
            'peristiwa_id' => $this->asas->id,
            'semester' => '1',
            'kelas_id' => $this->kelas->id,
            'kepala' => 'Kepala Madrasah',
        ]);
    }

    public function test_snapshot_penandatangan_dipakai_ulang_oleh_cetak_massal_dan_cetak_tunggal(): void
    {
        $santri = $this->santri('Ahmad', '26001', 90);
        $this->pasangPenandatangan('Siti Aminah', 'Kepala A');

        $pertama = $this->cetak('10')->assertOk()->json();
        $waliBeku = $pertama['penandatangan']['wali_kelas'];
        $kepalaBeku = $pertama['penandatangan']['kepala'];
        $this->assertSame('Ibu Usth. Siti Aminah, S.Pd.', $waliBeku);
        $this->assertSame('Kepala A', $kepalaBeku);

        $this->pasangPenandatangan('Nur Hidayah', 'Kepala B');

        $kedua = $this->cetak('10')->assertOk()->json();
        $this->assertSame($waliBeku, $kedua['penandatangan']['wali_kelas']);
        $this->assertSame($kepalaBeku, $kedua['penandatangan']['kepala']);
        $this->assertSame($waliBeku, $kedua['rapor'][0]['penandatangan']['wali_kelas']);

        $tunggal = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor?santri_id={$santri->id}&peristiwa_id={$this->asas->id}&semester=1&peringkat=10")
            ->assertOk()->json();
        $this->assertSame($waliBeku, $tunggal['penandatangan']['wali_kelas']);
        $this->assertSame($kepalaBeku, $tunggal['penandatangan']['kepala']);
    }

    public function test_snapshot_yang_masih_kosong_diisi_data_terbaru_lalu_dibekukan(): void
    {
        $this->santri('Ahmad', '26001', 90);

        $pertama = $this->cetak('10')->assertOk()->json();
        $this->assertNull($pertama['penandatangan']['wali_kelas']);
        $this->assertNull($pertama['penandatangan']['kepala']);

        $this->pasangPenandatangan('Siti Aminah', 'Kepala A');
        $kedua = $this->cetak('10')->assertOk()->json();
        $this->assertSame('Ibu Usth. Siti Aminah, S.Pd.', $kedua['penandatangan']['wali_kelas']);
        $this->assertSame('Kepala A', $kedua['penandatangan']['kepala']);

        $this->pasangPenandatangan('Nur Hidayah', 'Kepala B');
        $ketiga = $this->cetak('10')->assertOk()->json();
        $this->assertSame($kedua['penandatangan']['wali_kelas'], $ketiga['penandatangan']['wali_kelas']);
        $this->assertSame($kedua['penandatangan']['kepala'], $ketiga['penandatangan']['kepala']);
    }

    public function test_cetak_massal_ditolak_untuk_peristiwa_tanpa_rapor(): void
    {
        $this->santri('Ahmad', '26001', 90);
        $ujian = PeristiwaNilai::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'kode' => 'UJIAN',
            'nama' => 'Ujian Madrasah', 'cakupan' => 'semua',
            'kurikulum' => 'keduanya', 'jenis_rapor' => 'tidak_ada', 'urutan' => 2, 'is_active' => true,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor-kelas-cetak?peristiwa_id={$ujian->id}&semester=1&kelas_id={$this->kelas->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('peristiwa_id');
    }

    /** @return TestResponse */
    private function cetak(string $peringkat)
    {
        return $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/penilaian/rapor-kelas-cetak?peristiwa_id={$this->asas->id}&semester=1&kelas_id={$this->kelas->id}&peringkat={$peringkat}");
    }

    private function santri(string $nama, string $nis, float $nilai): Santri
    {
        $santri = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => $nis, 'is_active_lembaga' => 'Ya',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'semester' => '1',
            'kelas_id' => $this->kelas->id, 'tingkat' => '6',
            'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => RiwayatBelajar::YA,
        ]);
        NilaiSantri::create([
            'santri_id' => $santri->id, 'pengampu_mapel_id' => $this->pengampu->id,
            'tahun_ajaran' => self::TA, 'semester' => '1', 'peristiwa_id' => $this->asas->id,
            'nilai_akhir' => $nilai, 'sumber' => NilaiSantri::IMPOR,
        ]);

        return $santri;
    }

    private function pasangPenandatangan(string $wali, string $kepala): void
    {
        $pegawai = Pegawai::create([
            'nama_lengkap' => $wali, 'jenis_kelamin' => 'P',
            'gelar_depan' => 'Usth.', 'gelar_belakang' => 'S.Pd.',
        ]);
        $this->kelas->update(['walas_id' => $pegawai->id]);
        $this->lembaga->update(['mudir_am' => $kepala]);
    }

    /** @param  list<array<string, mixed>>  $rapor */
    private function cariRapor(array $rapor, string $nama): array
    {
        foreach ($rapor as $baris) {
            if ($baris['santri']['nama'] === $nama) {
                return $baris;
            }
        }
        $this->fail("Rapor {$nama} tidak ditemukan.");
    }
}
