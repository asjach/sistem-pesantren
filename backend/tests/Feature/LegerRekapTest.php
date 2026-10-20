<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MataPelajaran;
use App\Models\NilaiSantri;
use App\Models\PengampuMapel;
use App\Models\PeristiwaNilai;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

/** Jumlah dan peringkat Leger; peringkat dihitung per kelas. */
class LegerRekapTest extends TestCase
{
    use RefreshDatabase;

    private const TA = '2026/2027';

    private User $admin;

    private PeristiwaNilai $peristiwa;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'is_seleksi' => false,
            'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $this->admin = User::create([
            'name' => 'Admin Rekap', 'email' => 'admin-rekap@example.com',
            'phone' => '081555555555', 'password' => 'password',
        ]);
        $this->admin->assignRole('super_admin');
        $this->peristiwa = PeristiwaNilai::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'kode' => 'ASAS',
            'nama' => 'Asesmen Sumatif Akhir Semester', 'cakupan' => 'semua',
            'kurikulum' => 'keduanya', 'jenis_rapor' => 'akhir', 'urutan' => 1, 'is_active' => true,
        ]);
    }

    public function test_jumlah_dan_peringkat_dihitung_per_kelas(): void
    {
        $kelasA = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '6A', 'tingkat' => '6',
        ]);
        $kelasB = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '6B', 'tingkat' => '6',
        ]);
        $fikih = MataPelajaran::create(['jenjang' => 'MI', 'nama_mapel' => 'Fikih', 'kelompok' => 'formal']);
        $mtk = MataPelajaran::create(['jenjang' => 'MI', 'nama_mapel' => 'Matematika', 'kelompok' => 'formal']);

        $pengampu = function (int $kelasId, int $mapelId): int {
            return (int) PengampuMapel::create([
                'kelas_id' => $kelasId, 'mata_pelajaran_id' => $mapelId,
            ])->id;
        };
        $wa = $pengampu($kelasA->id, $fikih->id);
        $wb = $pengampu($kelasA->id, $mtk->id);
        $wc = $pengampu($kelasB->id, $fikih->id);
        $wd = $pengampu($kelasB->id, $mtk->id);

        $this->santri('Ahmad', '26001', $kelasA, $wa, $wb, 90, 80);
        $this->santri('Bilal', '26002', $kelasA, $wa, $wb, 80, 80);
        $this->santri('Cahya', '26003', $kelasA, $wa, $wb, 70, 60);
        $this->santri('Daud', '26004', $kelasB, $wc, $wd, 60, 60);

        $respons = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/penilaian/leger?peristiwa_id={$this->peristiwa->id}&semester=1")
            ->assertOk()
            ->json();

        $ahmad = $this->cari($respons['baris'], 'Ahmad');
        $this->assertSame(170.0, (float) $ahmad['jumlah']);
        $this->assertSame(85.0, (float) $ahmad['rata_rata']);
        $this->assertSame(1, $ahmad['peringkat']);
        $this->assertSame(3, $ahmad['peringkat_total']);

        $bilal = $this->cari($respons['baris'], 'Bilal');
        $this->assertSame(160.0, (float) $bilal['jumlah']);
        $this->assertSame(2, $bilal['peringkat']);

        $cahya = $this->cari($respons['baris'], 'Cahya');
        $this->assertSame(130.0, (float) $cahya['jumlah']);
        $this->assertSame(3, $cahya['peringkat']);

        $daud = $this->cari($respons['baris'], 'Daud');
        $this->assertSame(120.0, (float) $daud['jumlah']);
        $this->assertSame(1, $daud['peringkat']);
        $this->assertSame(1, $daud['peringkat_total']);
    }

    private function santri(
        string $nama,
        string $nis,
        Kelas $kelas,
        int $pengampuFikih,
        int $pengampuMtk,
        float $nilaiFikih,
        float $nilaiMtk,
    ): Santri {
        $santri = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => $nis, 'is_active_lembaga' => 'Ya',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'semester' => '1',
            'kelas_id' => $kelas->id, 'tingkat' => '6',
            'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => RiwayatBelajar::YA,
        ]);
        foreach ([[$pengampuFikih, $nilaiFikih], [$pengampuMtk, $nilaiMtk]] as [$pengampuId, $nilai]) {
            NilaiSantri::create([
                'santri_id' => $santri->id, 'pengampu_mapel_id' => $pengampuId,
                'tahun_ajaran' => self::TA, 'semester' => '1', 'peristiwa_id' => $this->peristiwa->id,
                'nilai_akhir' => $nilai, 'sumber' => NilaiSantri::IMPOR,
            ]);
        }

        return $santri;
    }

    /** @param  list<array<string, mixed>>  $baris */
    private function cari(array $baris, string $nama): array
    {
        foreach ($baris as $b) {
            if ($b['nama'] === $nama) {
                return $b;
            }
        }
        $this->fail("Baris {$nama} tidak ditemukan.");
    }
}
