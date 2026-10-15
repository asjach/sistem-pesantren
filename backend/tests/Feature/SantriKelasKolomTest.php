<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Kolom `kelas` pada daftar buku induk (`GET /api/admin/santri`).
 *
 * Nilainya dari `riwayat_belajar` TA acuan — aturan baris yang mewakili sama
 * dengan peta keuangan (`PetaSantriRiwayat`): semester 2 menang, jenjang
 * utama MI > MD, dan baris `pindah_keluar` tidak dipakai. Dipakai kolom
 * "Kelas" tabel Daftar Santri halaman Dispensasi.
 */
class SantriKelasKolomTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function baseFixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'nsm' => '123456789012',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD', 'nsm' => '123456789013',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        return compact('mi', 'md', 'ta');
    }

    protected function makeAdmin(array $lembagaIds = []): User
    {
        $u = User::create([
            'name' => 'Admin Kelas', 'email' => 'admin_kelas_'.uniqid().'@example.com',
            'phone' => '08'.str_pad((string) random_int(1000000000, 9999999999), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole('admin');
        foreach ($lembagaIds as $jenjang) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $jenjang,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function makeSantri(string $nama): Santri
    {
        return Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
    }

    /** @return array<string, mixed> baris pertama untuk satu nama */
    protected function barisUntuk(User $admin, string $nama, string $query = ''): array
    {
        $res = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/santri?per_page=50&'.$query)
            ->assertStatus(200);

        foreach ($res->json('data') as $baris) {
            if ($baris['nama_lengkap'] === $nama) {
                return $baris;
            }
        }
        $this->fail("Baris {$nama} tak ditemukan di daftar santri.");
    }

    public function test_kelas_diambil_dari_riwayat_ta_filter(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);
        $santri = $this->makeSantri('Ahmad Kelas');

        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '4B', 'tingkat' => '4',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => 'MI',
            'kelas_id' => $kelas->id, 'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif',
        ]);

        $this->assertSame('4B', $this->barisUntuk($admin, 'Ahmad Kelas', 'tahun_ajaran='.$f['ta']->nama)['kelas']);
    }

    public function test_semester_2_menang_dan_jenjang_mi_didahulukan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin(['MI', 'MD']);
        $santri = $this->makeSantri('Budi Dua Jenjang');

        $kelasMiGanjil = Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '1A', 'tingkat' => '1']);
        $kelasMiGenap = Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '1B', 'tingkat' => '1']);
        $kelasMdGenap = Kelas::create(['jenjang' => 'MD', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => 'MD-1', 'tingkat' => '1']);

        $riwayat = fn (string $jenjang, int $kelasId, string $semester) => RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => $jenjang,
            'kelas_id' => $kelasId, 'semester' => $semester, 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif',
        ]);
        $riwayat('MI', $kelasMiGanjil->id, '1');
        $riwayat('MD', $kelasMdGenap->id, '2');
        $riwayat('MI', $kelasMiGenap->id, '2');

        // MI menang atas MD walau keduanya semester 2; yang dipakai baris semester 2.
        $this->assertSame('1B', $this->barisUntuk($admin, 'Budi Dua Jenjang', 'tahun_ajaran='.$f['ta']->nama)['kelas']);
    }

    public function test_tanpa_filter_ta_memakai_ta_aktif_dan_null_bila_tak_ada_riwayat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $punya = $this->makeSantri('Cici Punya Riwayat');
        $kelas = Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '6C', 'tingkat' => '6']);
        RiwayatBelajar::create([
            'santri_id' => $punya->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => 'MI',
            'kelas_id' => $kelas->id, 'semester' => '2', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif',
        ]);
        $this->makeSantri('Dedi Tanpa Riwayat');

        // TA aktif = TA fixture, jadi tanpa filter pun kolomnya terisi.
        $this->assertSame('6C', $this->barisUntuk($admin, 'Cici Punya Riwayat')['kelas']);
        // Santri tanpa riwayat tetap tampil, kolom kelas null (bukan error).
        $this->assertNull($this->barisUntuk($admin, 'Dedi Tanpa Riwayat')['kelas']);
    }

    public function test_baris_pindah_keluar_tidak_dipakai(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);
        $santri = $this->makeSantri('Eka Pindah');

        $kelas = Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '5A', 'tingkat' => '5']);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => 'MI',
            'kelas_id' => $kelas->id, 'semester' => '2', 'status_awal' => 'santri_baru', 'status_akhir' => 'pindah_keluar',
        ]);

        $this->assertNull($this->barisUntuk($admin, 'Eka Pindah', 'tahun_ajaran='.$f['ta']->nama)['kelas']);
    }
}
