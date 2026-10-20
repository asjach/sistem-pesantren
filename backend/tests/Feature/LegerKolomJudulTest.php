<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MataPelajaran;
use App\Models\PengampuMapel;
use App\Models\PeristiwaNilai;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

/** Judul kolom crosstab Leger: kode mapel, fallback singkatan lalu nama. */
class LegerKolomJudulTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    public function test_judul_kolom_memakai_kode_mapel_dengan_fallback_singkatan_lalu_nama(): void
    {
        Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'is_seleksi' => false,
            'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);
        $admin = User::create([
            'name' => 'Admin Leger', 'email' => 'admin-leger@example.com',
            'phone' => '081333333333', 'password' => 'password',
        ]);
        $admin->assignRole('super_admin');

        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'nama_kelas' => '6A', 'tingkat' => '6',
        ]);
        $peristiwa = PeristiwaNilai::create([
            'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'kode' => 'ASAS',
            'nama' => 'Asesmen Sumatif Akhir Semester', 'cakupan' => 'semua',
            'kurikulum' => 'keduanya', 'jenis_rapor' => 'akhir', 'urutan' => 1, 'is_active' => true,
        ]);

        $this->mapel($kelas->id, 'Fiqih', 'FQH', null);
        $this->mapel($kelas->id, 'Matematika', '', 'MTK');
        $this->mapel($kelas->id, 'Ilmu Pengetahuan Alam', '', null);
        $this->mapel($kelas->id, 'Mapel Duplikat A', 'DUP', 'MDA');
        $this->mapel($kelas->id, 'Mapel Duplikat B', 'DUP', 'MDB');

        $respons = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/penilaian/leger?peristiwa_id={$peristiwa->id}&semester=1&kelas_id={$kelas->id}")
            ->assertOk()
            ->json();

        $judul = [];
        foreach ($respons['kolom'] as $kolom) {
            $judul[$kolom['nama_mapel']] = $kolom['judul'];
            $this->assertStringStartsWith('m', $kolom['key']);
        }

        $this->assertSame('FQH', $judul['Fiqih']);
        $this->assertSame('MTK', $judul['Matematika']);
        $this->assertSame('Ilmu Pengetahuan Alam', $judul['Ilmu Pengetahuan Alam']);
        $this->assertSame('MDA', $judul['Mapel Duplikat A']);
        $this->assertSame('MDB', $judul['Mapel Duplikat B']);
    }

    private function mapel(int $kelasId, string $nama, string $kode, ?string $singkatan): void
    {
        $mapel = MataPelajaran::create([
            'jenjang' => 'MI', 'nama_mapel' => $nama, 'kelompok' => 'formal',
            'kode_mapel' => $kode === '' ? null : $kode, 'singkatan' => $singkatan,
        ]);
        PengampuMapel::create(['kelas_id' => $kelasId, 'mata_pelajaran_id' => $mapel->id]);
    }
}
