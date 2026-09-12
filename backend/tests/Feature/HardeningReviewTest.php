<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HardeningReviewTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    protected function makeAdmin(): User
    {
        $u = User::create([
            'name' => 'Admin Throttle',
            'email' => 'throttle_' . uniqid() . '@example.com',
            'password' => 'password',
        ]);
        $u->assignRole('admin');

        return $u;
    }

    public function test_login_throttle_429_dan_key_identifier_ip(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/login', [
                'identifier' => 'target@example.com', 'password' => 'salah',
            ])->assertStatus(401);
        }

        $this->postJson('/api/auth/login', [
            'identifier' => 'target@example.com', 'password' => 'salah',
        ])->assertStatus(429);

        $this->postJson('/api/auth/login', [
            'identifier' => 'lain@example.com', 'password' => 'salah',
        ])->assertStatus(401);
    }

    public function test_import_throttle_429_setelah_batas(): void
    {
        $admin = $this->makeAdmin();

        for ($i = 0; $i < 10; $i++) {
            $this->actingAs($admin, 'sanctum')->postJson('/api/psb/import', [])
                ->assertStatus(422);
        }

        $this->actingAs($admin, 'sanctum')->postJson('/api/psb/import', [])
            ->assertStatus(429);
    }

    public function test_timezone_default_asia_jakarta(): void
    {
        $this->assertSame('Asia/Jakarta', config('app.timezone'));
    }

    public function test_login_desktop_hanya_super_admin_admin(): void
    {
        $ortu = User::create([
            'name' => 'Ortu Desktop',
            'email' => 'ortu_desktop_' . uniqid() . '@example.com',
            'password' => 'password',
        ]);
        $ortu->assignRole('orang_tua');

        // Device desktop dari peran portal → ditolak, tanpa token.
        $this->postJson('/api/auth/login', [
            'identifier' => $ortu->email, 'password' => 'password', 'device' => 'admin-desktop-tauri',
        ])->assertStatus(403);
        $this->assertDatabaseCount('personal_access_tokens', 0);

        // Device non-desktop (mis. portal) tetap boleh login.
        $this->postJson('/api/auth/login', [
            'identifier' => $ortu->email, 'password' => 'password', 'device' => 'portal-web',
        ])->assertStatus(200);

        // Admin boleh login dari desktop.
        $admin = $this->makeAdmin();
        $this->postJson('/api/auth/login', [
            'identifier' => $admin->email, 'password' => 'password', 'device' => 'admin-desktop-tauri',
        ])->assertStatus(200);
    }

    public function test_dashboard_ditolak_untuk_peran_portal(): void
    {
        $ortu = User::create([
            'name' => 'Ortu Dashboard',
            'email' => 'ortu_dash_' . uniqid() . '@example.com',
            'password' => 'password',
        ]);
        $ortu->assignRole('orang_tua');

        $this->actingAs($ortu, 'sanctum')->getJson('/api/dashboard/ringkasan')->assertStatus(403);
    }
}
