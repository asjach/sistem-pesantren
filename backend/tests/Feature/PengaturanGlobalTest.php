<?php

namespace Tests\Feature;

use App\Models\PengaturanGlobal;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PengaturanGlobalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function superAdmin(): User
    {
        $user = User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'phone' => '081234567890',
            'password' => 'password',
        ]);
        $user->assignRole('super_admin');

        return $user;
    }

    public function test_super_admin_dapat_menyimpan_standar(): void
    {
        $this->actingAs($this->superAdmin())->putJson('/api/admin/pengaturan-global', [
            'kunci' => 'tinggi_baris',
            'nilai' => 28,
        ])->assertOk();

        $this->assertSame(28, PengaturanGlobal::where('kunci', 'tinggi_baris')->firstOrFail()->nilai);
    }

    public function test_nilai_dijepit_ke_rentang(): void
    {
        $this->actingAs($this->superAdmin())->putJson('/api/admin/pengaturan-global', [
            'kunci' => 'tinggi_baris',
            'nilai' => 5,
        ])->assertJsonValidationErrors(['nilai']);
    }

    public function test_kunci_tak_dikenal_ditolak(): void
    {
        // Pencegahan penting: lebar sidebar sengaja TIDAK boleh jadi standar
        // global karena mengikuti ukuran layar tiap perangkat.
        $this->actingAs($this->superAdmin())->putJson('/api/admin/pengaturan-global', [
            'kunci' => 'lebar_sidebar',
            'nilai' => 300,
        ])->assertJsonValidationErrors(['kunci']);
    }

    public function test_nilai_kosong_menghapus_standar(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/pengaturan-global', [
            'kunci' => 'tinggi_baris',
            'nilai' => 28,
        ])->assertOk();

        $this->actingAs($admin)->putJson('/api/admin/pengaturan-global', [
            'kunci' => 'tinggi_baris',
            'nilai' => null,
        ])->assertOk();

        $this->assertNull(PengaturanGlobal::where('kunci', 'tinggi_baris')->firstOrFail()->nilai);
    }

    public function test_menyimpan_lagi_mengganti_bukan_menambah_baris(): void
    {
        $admin = $this->superAdmin();
        foreach ([28, 32] as $n) {
            $this->actingAs($admin)->putJson('/api/admin/pengaturan-global', [
                'kunci' => 'tinggi_baris',
                'nilai' => $n,
            ])->assertOk();
        }

        $this->assertSame(1, PengaturanGlobal::where('kunci', 'tinggi_baris')->count());
        $this->assertSame(32, PengaturanGlobal::where('kunci', 'tinggi_baris')->firstOrFail()->nilai);
    }

    public function test_memuat_peta_standar(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/pengaturan-global', [
            'kunci' => 'tinggi_header',
            'nilai' => 30,
        ])->assertOk();

        $res = $this->actingAs($admin)->getJson('/api/admin/pengaturan-global')->assertOk();

        $this->assertSame(30, $res->json('data.peta.tinggi_header'));
        $this->assertArrayNotHasKey('tinggi_baris', $res->json('data.peta'));
    }

    public function test_bukan_super_admin_tidak_boleh_menyimpan(): void
    {
        $user = User::create([
            'name' => 'Guru',
            'email' => 'guru@example.com',
            'phone' => '081234567891',
            'password' => 'password',
        ]);

        $this->actingAs($user)->putJson('/api/admin/pengaturan-global', [
            'kunci' => 'tinggi_baris',
            'nilai' => 28,
        ])->assertForbidden();
    }

    public function test_menghapus_standar(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/pengaturan-global', [
            'kunci' => 'tinggi_baris',
            'nilai' => 28,
        ])->assertOk();

        $this->actingAs($admin)
            ->deleteJson('/api/admin/pengaturan-global?kunci=tinggi_baris')
            ->assertOk();

        $this->assertSame(0, PengaturanGlobal::where('kunci', 'tinggi_baris')->count());
    }
}
