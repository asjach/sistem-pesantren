<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Paket sesi v1.8: expiry per peran, nama per-device, revokasi, logout-all.
class SessionFlowTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function makeUser(array $roles, ?string $email = null): User
    {
        $this->seq++;
        $u = User::create([
            'name' => 'Sesi ' . $this->seq,
            'email' => $email ?? "sesi{$this->seq}_" . uniqid() . '@example.com',
            'password' => 'password123',
        ]);
        $u->assignRole($roles);

        return $u;
    }

    protected function login(string $identifier, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/auth/login', array_merge([
            'identifier' => $identifier, 'password' => 'password123',
        ], $extra));
    }

    protected function freshGuards(): void
    {
        // Guard Sanctum di-cache per instance app dalam satu proses uji;
        // produksi (fresh boot per request) tidak terpengaruh. Lupakan agar
        // request berikut resolve ulang token dari DB.
        $this->app['auth']->forgetGuards();
    }

    public function test_staff_token_30_hari_dan_nama_device(): void
    {
        $u = $this->makeUser(['admin']);
        $res = $this->login($u->email, ['device' => 'Tauri-PC-TU-01'])->assertStatus(200);
        $this->assertNotEmpty($res->json('token'));

        $tok = $u->tokens()->firstOrFail();
        $this->assertEquals('Tauri-PC-TU-01', $tok->name);
        $this->assertEqualsWithDelta(now()->addDays(30)->timestamp, $tok->expires_at->timestamp, 120);
    }

    public function test_ortu_murni_token_365_hari(): void
    {
        $u = $this->makeUser(['orang_tua']);
        $this->login($u->email)->assertStatus(200);

        $tok = $u->tokens()->firstOrFail();
        $this->assertEquals('api-token', $tok->name); // default tanpa device
        $this->assertEqualsWithDelta(now()->addDays(365)->timestamp, $tok->expires_at->timestamp, 120);
    }

    public function test_rangkap_staf_ikut_30_hari(): void
    {
        $u = $this->makeUser(['guru', 'orang_tua']);
        $this->login($u->email)->assertStatus(200);

        $tok = $u->tokens()->firstOrFail();
        $this->assertEqualsWithDelta(now()->addDays(30)->timestamp, $tok->expires_at->timestamp, 120);
    }

    public function test_token_kedaluwarsa_ditolak(): void
    {
        $u = $this->makeUser(['admin']);
        $u->createToken('lama', ['*'], now()->subDay());

        $this->getJson('/api/auth/me', ['Authorization' => 'Bearer dummy'])
            ->assertStatus(401);
        // token basi di DB tetap ada sampai prune — guard yang menolak:
        $plain = $u->createToken('basi', ['*'], now()->subDay())->plainTextToken;
        $this->freshGuards();
        $this->getJson('/api/auth/me', ['Authorization' => "Bearer $plain"])
            ->assertStatus(401);
    }

    public function test_logout_all_mematikan_semua_token(): void
    {
        $u = $this->makeUser(['admin']);
        $t1 = $this->login($u->email, ['device' => 'PC-1'])->json('token');
        $t2 = $this->login($u->email, ['device' => 'PC-2'])->json('token');
        $this->assertEquals(2, $u->tokens()->count());

        $this->postJson('/api/auth/logout-all', [], ['Authorization' => "Bearer $t1"])
            ->assertStatus(200);
        $this->assertEquals(0, $u->tokens()->count());
        $this->freshGuards();
        $this->getJson('/api/auth/me', ['Authorization' => "Bearer $t2"])->assertStatus(401);
    }

    public function test_ganti_peran_mencabut_token_target(): void
    {
        $sa = $this->makeUser(['super_admin']);
        $target = $this->makeUser(['kasir']);
        $tok = $this->login($target->email)->json('token');
        $this->assertEquals(1, $target->tokens()->count());

        $this->actingAs($sa, 'sanctum')->postJson(
            "/api/admin/users/{$target->id}/roles", ['role' => 'guru']
        )->assertStatus(200);
        $this->assertEquals(0, $target->fresh()->tokens()->count());
        $this->freshGuards();
        $this->getJson('/api/auth/me', ['Authorization' => "Bearer $tok"])->assertStatus(401);

        // cabut peran juga mencabut
        $tok2 = $this->login($target->email)->json('token');
        $this->actingAs($sa, 'sanctum')->deleteJson(
            "/api/admin/users/{$target->id}/roles", ['role' => 'guru']
        )->assertStatus(200);
        $this->assertEquals(0, $target->fresh()->tokens()->count());
        $this->freshGuards();
        $this->getJson('/api/auth/me', ['Authorization' => "Bearer $tok2"])->assertStatus(401);
    }
}
