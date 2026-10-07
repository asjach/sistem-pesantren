<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\JenisTagihan;
use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\MutasiKeluar;
use App\Models\Pegawai;
use App\Models\PsbCalonSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DashboardRingkasanTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        $user = User::create([
            'name' => 'Super Dashboard',
            'email' => 'dash_'.uniqid().'@example.com',
            'password' => 'password',
        ]);
        $user->assignRole('super_admin');

        return $user;
    }

    private function buatSantri(string $nama, string $jk, string $tipe = 'non_asrama'): Santri
    {
        return Santri::create([
            'nama_lengkap' => $nama,
            'jk' => $jk,
            'tipe_santri' => $tipe,
        ]);
    }

    private function riwayat(
        Santri $santri,
        string $jenjang,
        string $tahunAjaran,
        string $aktif = 'Ya',
    ): RiwayatBelajar {
        return RiwayatBelajar::create([
            'santri_id' => $santri->id,
            'jenjang' => $jenjang,
            'tahun_ajaran' => $tahunAjaran,
            'semester' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
            'is_active_riwayat' => $aktif,
        ]);
    }

    public function test_ringkasan_menghitung_statistik_dari_data(): void
    {
        $admin = $this->superAdmin();

        Lembaga::create(['nama' => 'Ibtidaiyah', 'jenjang' => 'MI']);
        Lembaga::create(['nama' => 'Diniyah', 'jenjang' => 'MD']);
        Lembaga::create(['nama' => 'Tsanawiyah', 'jenjang' => 'MTS']);

        $ta = TahunAjaran::create(['nama' => '2025/2026', 'is_aktif' => true]);
        TahunAjaran::create(['nama' => '2024/2025', 'is_aktif' => false]);

        Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => $ta->nama, 'nama_kelas' => 'I-A']);
        Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => $ta->nama, 'nama_kelas' => 'I-B']);
        Kelas::create(['jenjang' => 'MD', 'tahun_ajaran' => $ta->nama, 'nama_kelas' => 'D-A']);
        Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => '2024/2025', 'nama_kelas' => 'I-LAMA']);

        $s1 = $this->buatSantri('Ahmad', 'L', 'asrama');
        $s2 = $this->buatSantri('Bila', 'P');
        $s3 = $this->buatSantri('Cakra', 'L');
        $s4 = $this->buatSantri('Dedi', 'L');

        $this->riwayat($s1, 'MI', $ta->nama);
        $this->riwayat($s2, 'MD', $ta->nama);
        $this->riwayat($s3, 'MI', $ta->nama);
        $this->riwayat($s3, 'MD', $ta->nama);
        $this->riwayat($s4, 'MI', '2024/2025', 'Tidak');

        $p1 = Pegawai::create(['nama_lengkap' => 'Guru Satu', 'jenis_kelamin' => 'L']);
        $p2 = Pegawai::create(['nama_lengkap' => 'Guru Dua', 'jenis_kelamin' => 'P']);
        LembagaPegawai::create(['pegawai_id' => $p1->id, 'jenjang' => 'MI']);
        LembagaPegawai::create(['pegawai_id' => $p2->id, 'jenjang' => 'MD']);
        KeaktifanPegawai::create(['pegawai_id' => $p1->id, 'jenjang' => 'MI', 'tahun_ajaran' => $ta->nama]);
        KeaktifanPegawai::create(['pegawai_id' => $p2->id, 'jenjang' => 'MD', 'tahun_ajaran' => $ta->nama]);

        $jenis = JenisTagihan::create(['nama' => 'SPP', 'tipe' => 'non_bulanan']);
        Tagihan::create([
            'santri_id' => $s1->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => $ta->nama,
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 100000, 'terbayar' => 0,
            'status' => 'belum', 'jatuh_tempo' => today()->subDay(),
        ]);
        Tagihan::create([
            'santri_id' => $s2->id, 'jenjang' => 'MD', 'paket' => 'MD', 'tahun_ajaran' => $ta->nama,
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 50000, 'terbayar' => 50000,
            'status' => 'lunas', 'jatuh_tempo' => today()->subDay(),
        ]);
        Tagihan::create([
            'santri_id' => $s3->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => $ta->nama,
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 40000, 'terbayar' => 0,
            'status' => 'belum', 'jatuh_tempo' => today()->addDay(),
        ]);

        Alumni::create(['santri_id' => $s4->id, 'lembaga_lulus' => 'MI', 'tahun_ajaran_lulus' => '2024/2025']);
        Alumni::create(['santri_id' => $s3->id, 'lembaga_lulus' => 'MI', 'tahun_ajaran_lulus' => $ta->nama]);
        MutasiKeluar::create(['santri_id' => $s4->id, 'jenjang' => 'MI', 'tanggal_mutasi' => '2025-08-01']);

        PsbCalonSantri::create([
            'jenjang' => 'MI', 'no_pendaftaran' => 'PSB-1', 'nik' => '3201010101010001',
            'nama_lengkap' => 'Calon Satu', 'status_pendaftaran' => 'baru',
        ]);
        PsbCalonSantri::create([
            'jenjang' => 'MD', 'no_pendaftaran' => 'PSB-2', 'nik' => '3201010101010002',
            'nama_lengkap' => 'Calon Dua', 'status_pendaftaran' => 'terverifikasi',
        ]);

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/ringkasan')->assertOk();

        $res->assertJsonPath('lembaga', 3)
            ->assertJsonPath('kelas', 4)
            ->assertJsonPath('kelas_aktif', 3)
            ->assertJsonPath('santri.total', 3)
            ->assertJsonPath('santri.laki_laki', 2)
            ->assertJsonPath('santri.perempuan', 1)
            ->assertJsonPath('santri.asrama', 1)
            ->assertJsonPath('santri.non_asrama', 2)
            ->assertJsonPath('santri.baru_ta_aktif', 3)
            ->assertJsonPath('pegawai.total', 2)
            ->assertJsonPath('pegawai.aktif', 2)
            ->assertJsonPath('keuangan.jumlah_tagihan', 3)
            ->assertJsonPath('keuangan.nominal', 190000)
            ->assertJsonPath('keuangan.terbayar', 50000)
            ->assertJsonPath('keuangan.tunggakan', 100000)
            ->assertJsonPath('keuangan.lunas', 1)
            ->assertJsonPath('keuangan.belum', 2)
            ->assertJsonPath('keuangan.sebagian', 0)
            ->assertJsonPath('siklus.alumni', 2)
            ->assertJsonPath('siklus.alumni_ta_aktif', 1)
            ->assertJsonPath('siklus.mutasi', 1)
            ->assertJsonPath('siklus.mutasi_ta_aktif', 1)
            ->assertJsonPath('psb.total', 2)
            ->assertJsonPath('psb.per_status.baru', 1)
            ->assertJsonPath('psb.per_status.terverifikasi', 1);

        $perLembaga = collect($res->json('santri.per_lembaga'))->keyBy('jenjang');
        $this->assertSame(2, $perLembaga['MI']['jumlah']);
        $this->assertSame(2, $perLembaga['MD']['jumlah']);
        $this->assertSame(0, $perLembaga['MTS']['jumlah']);
    }

    public function test_ringkasan_menyaring_per_lembaga(): void
    {
        $admin = $this->superAdmin();

        Lembaga::create(['nama' => 'Ibtidaiyah', 'jenjang' => 'MI']);
        Lembaga::create(['nama' => 'Diniyah', 'jenjang' => 'MD']);
        $ta = TahunAjaran::create(['nama' => '2025/2026', 'is_aktif' => true]);

        $this->riwayat($this->buatSantri('Ahmad', 'L'), 'MI', $ta->nama);
        $this->riwayat($this->buatSantri('Bila', 'P'), 'MD', $ta->nama);

        $res = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/dashboard/ringkasan?jenjang=MI')
            ->assertOk();

        $res->assertJsonPath('lembaga', 1)
            ->assertJsonPath('santri.total', 1)
            ->assertJsonPath('santri.per_lembaga.0.jenjang', 'MI');
        $this->assertCount(1, $res->json('santri.per_lembaga'));
    }

    public function test_statistik_modul_digerbangi_izin(): void
    {
        $user = User::create([
            'name' => 'Pengawas Dashboard',
            'email' => 'pengawas_'.uniqid().'@example.com',
            'password' => 'password',
        ]);
        $role = Role::create(['name' => 'pengawas_dashboard', 'guard_name' => 'sanctum']);
        $role->syncPermissions(['dashboard.lihat', 'santri.lihat']);
        $user->assignRole($role);

        $res = $this->actingAs($user, 'sanctum')->getJson('/api/dashboard/ringkasan')->assertOk();

        $this->assertNull($res->json('keuangan'));
        $this->assertNull($res->json('pegawai'));
        $this->assertNull($res->json('psb'));
        $this->assertIsArray($res->json('santri'));
        $this->assertArrayHasKey('total', $res->json('santri'));
    }
}
