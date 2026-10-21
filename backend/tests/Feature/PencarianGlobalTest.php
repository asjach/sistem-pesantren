<?php

namespace Tests\Feature;

use App\Models\Pegawai;
use App\Models\Santri;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PencarianGlobalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        $santri = Santri::create([
            'nama_lengkap' => 'Ahmad Fauzi',
            'jk' => 'L',
            'nisn' => '1234567890',
            'is_active_pst' => 'Ya',
        ]);

        Pegawai::create([
            'nama_lengkap' => 'Ustadz Ahmad',
            'jenis_kelamin' => 'L',
            'nipp' => 'PST-001',
        ]);
    }

    /** @param list<string> $peran */
    private function pengguna(array $peran): User
    {
        $user = User::create([
            'name' => 'Uji Cari '.uniqid(),
            'email' => 'cari_'.uniqid().'@example.com',
            'password' => 'password123',
        ]);
        $user->assignRole($peran);

        return $user;
    }

    public function test_setelan_awal_empat_halaman_aktif(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->getJson('/api/admin/pencarian-global')
            ->assertOk()
            ->assertJsonPath('data.0.page_key', 'daftar_kelas')
            ->assertJsonPath('data.0.aktif', true)
            ->assertJsonPath('data.1.page_key', 'santri')
            ->assertJsonPath('data.2.page_key', 'pegawai')
            ->assertJsonPath('data.3.page_key', 'keuangan');
    }

    public function test_mencari_santri_dan_pegawai_lintas_halaman(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->getJson('/api/admin/pencarian?q=Ahmad')
            ->assertOk()
            ->assertJsonPath('hasil.0.halaman', 'santri')
            ->assertJsonPath('hasil.0.hasil.0.judul', 'Ahmad Fauzi')
            ->assertJsonPath('hasil.1.halaman', 'daftar_kelas')
            ->assertJsonPath('hasil.2.halaman', 'keuangan')
            ->assertJsonPath('hasil.3.halaman', 'pegawai')
            ->assertJsonPath('hasil.3.hasil.0.judul', 'Ustadz Ahmad');
    }

    public function test_halaman_yang_dinonaktifkan_tidak_ikut_dicari(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->putJson('/api/admin/pencarian-global', [
            'aktif' => ['santri' => false, 'daftar_kelas' => false, 'keuangan' => false, 'pegawai' => true],
        ])->assertOk();

        $hasil = $this->getJson('/api/admin/pencarian?q=Ahmad')->assertOk()->json('hasil');
        $this->assertSame([], collect($hasil)->pluck('halaman')->intersect(['santri', 'daftar_kelas', 'keuangan'])->all());
        $this->assertSame('pegawai', $hasil[0]['halaman']);
    }

    public function test_pengguna_tanpa_izin_ditolak(): void
    {
        Sanctum::actingAs($this->pengguna(['guru']));

        $this->getJson('/api/admin/pencarian?q=Ahmad')->assertStatus(403);
    }

    public function test_admin_tidak_bisa_membuka_setelan_pencarian(): void
    {
        Sanctum::actingAs($this->pengguna(['admin']));

        $this->getJson('/api/admin/pencarian-global')->assertStatus(403);
    }
}
