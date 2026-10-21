<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PengaturanNavigasiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    /** @param list<string> $peran */
    private function pengguna(array $peran): User
    {
        $user = User::create([
            'name' => 'Uji Navigasi '.uniqid(),
            'email' => 'nav_'.uniqid().'@example.com',
            'password' => 'password123',
        ]);
        $user->assignRole($peran);

        return $user;
    }

    public function test_super_admin_menyimpan_setelan_global(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->putJson('/api/admin/pengaturan-navigasi', [
            'tersembunyi' => ['grup:penilaian', 'tab:/lembaga'],
        ])
            ->assertOk()
            ->assertJsonPath('mode', 'global')
            ->assertJsonPath('global_tersembunyi', ['grup:penilaian', 'tab:/lembaga'])
            ->assertJsonPath('tersembunyi', ['grup:penilaian', 'tab:/lembaga']);

        $this->getJson('/api/admin/pengaturan-navigasi')
            ->assertOk()
            ->assertJsonPath('mode', 'global')
            ->assertJsonPath('tersembunyi', ['grup:penilaian', 'tab:/lembaga']);
    }

    public function test_admin_bisa_mengatur_pilihan_pribadi_di_atas_setelan_global(): void
    {
        $global = $this->pengguna(['super_admin']);
        Sanctum::actingAs($global);
        $this->putJson('/api/admin/pengaturan-navigasi', ['tersembunyi' => ['grup:penilaian']])
            ->assertOk();

        $admin = $this->pengguna(['admin']);
        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/pengaturan-navigasi')
            ->assertOk()
            ->assertJsonPath('mode', 'pribadi')
            ->assertJsonPath('global_tersembunyi', ['grup:penilaian'])
            ->assertJsonPath('pribadi_tersembunyi', [])
            ->assertJsonPath('tersembunyi', ['grup:penilaian']);

        $this->putJson('/api/admin/pengaturan-navigasi', [
            'tersembunyi' => ['grup:penilaian', 'halaman:/penilaian/leger'],
        ])
            ->assertOk()
            ->assertJsonPath('mode', 'pribadi')
            ->assertJsonPath('pribadi_tersembunyi', ['halaman:/penilaian/leger'])
            ->assertJsonPath('tersembunyi', ['grup:penilaian', 'halaman:/penilaian/leger']);

        // Setelan admin tidak mengubah global.
        Sanctum::actingAs($global);
        $this->getJson('/api/admin/pengaturan-navigasi')
            ->assertOk()
            ->assertJsonPath('tersembunyi', ['grup:penilaian']);
    }

    public function test_admin_tidak_bisa_menampilkan_entri_yang_disembunyikan_global(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));
        $this->putJson('/api/admin/pengaturan-navigasi', ['tersembunyi' => ['grup:penilaian']])
            ->assertOk();

        Sanctum::actingAs($this->pengguna(['admin']));
        $this->putJson('/api/admin/pengaturan-navigasi', ['tersembunyi' => []])
            ->assertOk()
            ->assertJsonPath('pribadi_tersembunyi', [])
            ->assertJsonPath('tersembunyi', ['grup:penilaian']);
    }

    public function test_pengguna_tanpa_izin_navigasi_ditolak(): void
    {
        Sanctum::actingAs($this->pengguna(['guru']));

        $this->getJson('/api/admin/pengaturan-navigasi')->assertStatus(403);
        $this->putJson('/api/admin/pengaturan-navigasi', ['tersembunyi' => []])->assertStatus(403);
    }

    public function test_daftar_tersembunyi_divalidasi(): void
    {
        Sanctum::actingAs($this->pengguna(['super_admin']));

        $this->putJson('/api/admin/pengaturan-navigasi', ['tersembunyi' => 'bukan-array'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('tersembunyi');
    }
}
