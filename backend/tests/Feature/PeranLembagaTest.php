<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Pemetaan peran per lembaga (`user_lembaga.role`):
 * satu akun bisa admin di MI sekaligus guru di MLN.
 */
class PeranLembagaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        Lembaga::create(['nama' => 'MLN', 'jenjang' => 'MLN', 'is_active' => true]);
    }

    private function superAdmin(): User
    {
        $user = User::create([
            'name' => 'Super',
            'email' => 'super-'.uniqid().'@example.com',
            'password' => 'password',
        ]);
        $user->assignRole('super_admin');

        return $user;
    }

    private function pivot(int $userId, string $jenjang): array
    {
        $daftar = DB::table('user_lembaga')
            ->where('user_id', $userId)->where('jenjang', $jenjang)
            ->pluck('role')->all();
        usort($daftar, fn ($a, $b) => $a === null ? 1 : ($b === null ? -1 : strcmp($a, $b)));

        return $daftar;
    }

    public function test_akun_otomatis_guru_mencatat_peran(): void
    {
        $auth = $this->superAdmin();
        $guru = Pegawai::create([
            'nama_lengkap' => 'Guru Peran', 'jenis_kelamin' => 'L', 'email_pribadi' => 'guru.peran@example.com',
        ]);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();
        $res = $this->actingAs($auth, 'sanctum')
            ->postJson("/api/admin/pegawai/{$guru->id}/buatkan-akun")
            ->assertCreated();

        $userId = $res->json('data.user_id');
        $this->assertSame(['guru'], $this->pivot($userId, 'MI'));
    }

    public function test_nonaktifkan_hanya_mencabut_baris_guru(): void
    {
        $auth = $this->superAdmin();
        $user = User::create(['name' => 'Ganda', 'email' => 'ganda@example.com', 'password' => 'password']);
        $user->assignRole('guru');
        $guru = Pegawai::create([
            'nama_lengkap' => 'Ganda', 'jenis_kelamin' => 'P', 'email_pribadi' => 'ganda@example.com',
            'user_id' => $user->id,
        ]);
        DB::table('user_lembaga')->insert([
            'user_id' => $user->id, 'jenjang' => 'MI', 'role' => 'admin',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$guru->id}/tempatkan", [
            'jenjang' => 'MI',
        ])->assertCreated();
        $this->assertSame(['admin', 'guru'], $this->pivot($user->id, 'MI'));

        $tempatId = LembagaPegawai::untuk($guru->id, 'MI')->id;
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai-lembaga/{$tempatId}/nonaktifkan")->assertOk();

        // Baris guru dicabut; baris admin manual utuh.
        $this->assertSame(['admin'], $this->pivot($user->id, 'MI'));
    }

    public function test_resolusi_izin_mengikuti_peran_lembaga_konteks(): void
    {
        $auth = $this->superAdmin();
        $user = User::create(['name' => 'Campuran', 'email' => 'campuran@example.com', 'password' => 'password']);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/users/{$user->id}/lembaga", [
            'jenjang' => 'MI', 'role' => 'admin',
        ])->assertOk();
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/users/{$user->id}/lembaga", [
            'jenjang' => 'MLN', 'role' => 'guru',
        ])->assertOk();

        $this->assertTrue($user->fresh()->punyaPeranDi('admin', 'MI'));
        $this->assertTrue($user->fresh()->punyaPeranDi('guru', 'MLN'));
        $this->assertFalse($user->fresh()->punyaPeranDi('admin', 'MLN'));

        // Peran admin (berizin) hanya efektif dalam konteks MI.
        $this->actingAs($user, 'sanctum')->getJson('/api/admin/pegawai-lembaga?jenjang=MI')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/admin/pegawai-lembaga?jenjang=MLN')->assertForbidden();
        $this->actingAs($user, 'sanctum')->getJson('/api/admin/pegawai-lembaga')->assertForbidden();

        // /me?jenjang=MI memuat izin peran pivot; /me global memuat gabungannya.
        $denganKonteks = $this->actingAs($user, 'sanctum')->getJson('/api/auth/me?jenjang=MI')->assertOk();
        $this->assertContains('pegawai.lihat', $denganKonteks->json('permissions'));
        $tanpaKonteks = $this->actingAs($user, 'sanctum')->getJson('/api/auth/me')->assertOk();
        $this->assertContains('pegawai.lihat', $tanpaKonteks->json('permissions'));
    }

    public function test_peran_guru_kosong_tetap_tak_memberi_izin(): void
    {
        Role::where('name', 'guru')->firstOrFail()->syncPermissions([]);
        $user = User::create(['name' => 'Guru Saja', 'email' => 'guru.saja@example.com', 'password' => 'password']);
        DB::table('user_lembaga')->insert([
            'user_id' => $user->id, 'jenjang' => 'MLN', 'role' => 'guru',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($user, 'sanctum')->getJson('/api/admin/pegawai-lembaga?jenjang=MLN')->assertForbidden();
    }

    public function test_attach_menolak_peran_global_dan_di_luar_wewenang(): void
    {
        $auth = $this->superAdmin();
        $user = User::create(['name' => 'Target', 'email' => 'target@example.com', 'password' => 'password']);

        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/users/{$user->id}/lembaga", [
            'jenjang' => 'MI', 'role' => 'super_admin',
        ])->assertStatus(422);
        $this->actingAs($auth, 'sanctum')->postJson("/api/admin/users/{$user->id}/lembaga", [
            'jenjang' => 'MI', 'role' => 'ketua',
        ])->assertStatus(422);
        $this->assertSame([], $this->pivot($user->id, 'MI'));
    }

    public function test_detach_per_peran_dan_sync_mempertahankan_baris_berperan(): void
    {
        $auth = $this->superAdmin();
        $user = User::create(['name' => 'Lepas', 'email' => 'lepas@example.com', 'password' => 'password']);
        $user->assignRole('admin');
        foreach (['admin', 'guru', null] as $role) {
            DB::table('user_lembaga')->insert([
                'user_id' => $user->id, 'jenjang' => 'MI', 'role' => $role,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        // Lepas hanya baris guru.
        $this->actingAs($auth, 'sanctum')->deleteJson("/api/admin/users/{$user->id}/lembaga", [
            'jenjang' => 'MI', 'role' => 'guru',
        ])->assertOk();
        $this->assertSame(['admin', null], $this->pivot($user->id, 'MI'));

        // Sync jenjangs (PUT) hanya mengganti baris warisan.
        $this->actingAs($auth, 'sanctum')->putJson("/api/admin/users/{$user->id}", [
            'jenjangs' => ['MI', 'MLN'],
        ])->assertOk();
        $this->assertSame(['admin', null], $this->pivot($user->id, 'MI'));
        $this->assertSame([null], $this->pivot($user->id, 'MLN'));
    }
}
