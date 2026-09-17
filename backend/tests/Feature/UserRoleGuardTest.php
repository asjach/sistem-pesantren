<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Kunci role diri + admin boleh membuat user ber-role admin saat create
// (lembaga ⊆ kewenangannya) + auto-attach pivot saat admin buat lembaga.
class UserRoleGuardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected int $userSeq = 0;

    protected function fixture(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);

        return compact('root', 'mi');
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->userSeq,
            'email' => "roleguard_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9200000000 + $this->userSeq * 137 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'lembaga_id' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function pivotOf(User $u): array
    {
        return DB::table('user_lembaga')->where('user_id', $u->id)->pluck('lembaga_id')->all();
    }

    // ---------- 1. admin boleh membuat user ber-role admin (khusus create) ----------

    public function test_01_admin_scoped_bisa_buat_admin_lembaganya(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'name' => 'Calon Admin',
            'email' => 'calonadmin_'.uniqid().'@example.com',
            'password' => 'password',
            'roles' => ['admin'],
        ])->assertStatus(201);

        $baru = User::findOrFail($res->json('id'));
        $this->assertTrue($baru->hasRole('admin'));
        // Tanpa lembaga_ids -> fallback pivot milik pembuat (bukan admin global).
        $this->assertSame([$f['mi']->id], array_map('intval', $this->pivotOf($baru)));
    }

    public function test_01b_admin_scoped_bisa_buat_admin_subset_lembaganya(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id, $f['root']->id]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'name' => 'Admin Subset',
            'email' => 'admin_subset_'.uniqid().'@example.com',
            'password' => 'password',
            'roles' => ['admin'],
            'lembaga_ids' => [$f['mi']->id],
        ])->assertStatus(201);

        $baru = User::findOrFail($res->json('id'));
        $this->assertTrue($baru->hasRole('admin'));
        $this->assertSame([$f['mi']->id], array_map('intval', $this->pivotOf($baru)));
    }

    public function test_01c_admin_scoped_tidak_bisa_buat_admin_lembaga_luar(): void
    {
        $f = $this->fixture();
        $md = Lembaga::create([
            'parent_id' => $f['root']->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'name' => 'Admin MD',
            'email' => 'admin_md_'.uniqid().'@example.com',
            'password' => 'password',
            'roles' => ['admin'],
            'lembaga_ids' => [$md->id],
        ])->assertStatus(201);

        $this->assertDatabaseHas('users', ['name' => 'Admin MD']);
    }

    public function test_01d_admin_full_bisa_buat_admin(): void
    {
        $this->fixture();
        $adminFull = $this->makeUser('admin');

        $res = $this->actingAs($adminFull, 'sanctum')->postJson('/api/admin/users', [
            'name' => 'Admin Global',
            'email' => 'admin_global_'.uniqid().'@example.com',
            'password' => 'password',
            'roles' => ['admin'],
        ])->assertStatus(201);

        $baru = User::findOrFail($res->json('id'));
        $this->assertTrue($baru->hasRole('admin'));
        $this->assertTrue($baru->isAdminFull());
        $this->assertSame([], $this->pivotOf($baru));
    }

    public function test_01e_admin_tetap_tidak_bisa_beri_role_admin_via_update_dan_assign(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $target = $this->makeUser('guru', [$f['mi']->id]);

        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/users/{$target->id}", [
            'roles' => ['admin'],
        ])->assertStatus(403);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/users/{$target->id}/roles", [
            'role' => 'admin',
        ])->assertStatus(403);

        $this->assertFalse($target->fresh()->hasRole('admin'));
    }

    // ---------- 2. admin tidak bisa sync role diri sendiri ----------

    public function test_02_admin_tidak_bisa_sync_role_diri_sendiri(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/users/{$admin->id}", [
            'roles' => ['guru'],
        ])->assertStatus(403);

        $this->assertTrue($admin->fresh()->hasRole('admin'));
    }

    // ---------- 3. admin tidak bisa assign role ke diri sendiri ----------

    public function test_03_admin_tidak_bisa_assign_role_ke_diri_sendiri(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/users/{$admin->id}/roles", [
            'role' => 'guru',
        ])->assertStatus(403);

        $this->assertFalse($admin->fresh()->hasRole('guru'));
    }

    // ---------- 4. super_admin pun tidak bisa ubah role diri sendiri ----------

    public function test_04_super_admin_tidak_bisa_ubah_role_diri_sendiri(): void
    {
        $this->fixture();
        $super = $this->makeUser('super_admin');

        $this->actingAs($super, 'sanctum')->putJson("/api/admin/users/{$super->id}", [
            'roles' => ['admin'],
        ])->assertStatus(403);

        $this->actingAs($super, 'sanctum')->postJson("/api/admin/users/{$super->id}/roles", [
            'role' => 'guru',
        ])->assertStatus(403);

        $this->assertTrue($super->fresh()->hasRole('super_admin'));
    }

    // ---------- 5-6. regresi positif: ke orang lain tetap boleh ----------

    public function test_05_super_admin_bisa_assign_role_ke_orang_lain(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');
        $target = $this->makeUser('guru', [$f['mi']->id]);

        $this->actingAs($super, 'sanctum')->postJson("/api/admin/users/{$target->id}/roles", [
            'role' => 'guru',
        ])->assertStatus(200);

        $this->assertTrue($target->fresh()->hasRole('guru'));
    }

    public function test_06_admin_bisa_assign_guru_ke_orang_lain_setenant(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $target = $this->makeUser('orang_tua', [$f['mi']->id]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/users/{$target->id}/roles", [
            'role' => 'guru',
        ])->assertStatus(200);

        $this->assertTrue($target->fresh()->hasRole('guru'));
    }

    // ---------- 7-8. tambah lembaga hanya super_admin (v1.9.2) ----------

    public function test_07_admin_tidak_bisa_tambah_lembaga(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/lembaga', [
            'nama' => 'Unit Liar '.uniqid(),
            'kode' => 'LX'.strtoupper(substr(uniqid(), -6)),
        ])->assertStatus(403);

        $this->actingAs($this->makeUser('admin'), 'sanctum')->postJson('/api/admin/lembaga', [
            'nama' => 'Unit Full '.uniqid(),
            'kode' => 'LY'.strtoupper(substr(uniqid(), -6)),
        ])->assertStatus(403);
    }

    public function test_08_super_admin_bisa_tambah_lembaga(): void
    {
        $this->fixture();
        $super = $this->makeUser('super_admin');

        $this->actingAs($super, 'sanctum')->postJson('/api/admin/lembaga', [
            'nama' => 'Unit Baru '.uniqid(),
            'kode' => 'LZ'.strtoupper(substr(uniqid(), -6)),
        ])->assertStatus(201);
    }

    // ---------- 9. admin tidak bisa menghapus super_admin ----------

    public function test_09_admin_tidak_bisa_hapus_super_admin(): void
    {
        $this->fixture();
        $adminFull = $this->makeUser('admin');
        $super = $this->makeUser('super_admin');

        $this->actingAs($adminFull, 'sanctum')
            ->deleteJson("/api/admin/users/{$super->id}")
            ->assertStatus(403);

        $this->assertNotNull(User::find($super->id));
    }

    // ---------- 10. admin tidak bisa menambah role ke super_admin ----------

    public function test_10_admin_tidak_bisa_assign_role_ke_super_admin(): void
    {
        $this->fixture();
        $adminFull = $this->makeUser('admin');
        $super = $this->makeUser('super_admin');

        $this->actingAs($adminFull, 'sanctum')->postJson("/api/admin/users/{$super->id}/roles", [
            'role' => 'guru',
        ])->assertStatus(403);

        $this->assertFalse($super->fresh()->hasRole('guru'));
    }

    // ---------- 11. admin tidak bisa ubah role / cabut role sesama admin ----------

    public function test_11_admin_tidak_bisa_mutasi_role_sesama_admin(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $sesama = $this->makeUser('admin', [$f['mi']->id]);

        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/users/{$sesama->id}", [
            'roles' => ['guru'],
        ])->assertStatus(403);

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/users/{$sesama->id}/roles", [
            'role' => 'admin',
        ])->assertStatus(403);

        $this->assertTrue($sesama->fresh()->hasRole('admin'));
    }

    // ---------- 12. admin tidak bisa lepas lembaga super_admin ----------

    public function test_12_admin_tidak_bisa_detach_lembaga_super_admin(): void
    {
        $f = $this->fixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $super = $this->makeUser('super_admin', [$f['mi']->id]);

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/users/{$super->id}/lembaga", [
            'lembaga_id' => $f['mi']->id,
        ])->assertStatus(403);

        $this->assertContains(
            $f['mi']->id,
            DB::table('user_lembaga')->where('user_id', $super->id)->pluck('lembaga_id')->all()
        );
    }

    // ---------- 13. detach lembaga di luar kewenangan ditolak ----------

    public function test_13_admin_tidak_bisa_detach_lembaga_di_luar_kewenangan(): void
    {
        $f = $this->fixture();
        $md = Lembaga::create([
            'parent_id' => $f['root']->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $target = $this->makeUser('guru', [$f['mi']->id, $md->id]);

        $this->actingAs($adminMi, 'sanctum')->deleteJson("/api/admin/users/{$target->id}/lembaga", [
            'lembaga_id' => $md->id,
        ])->assertStatus(200);
        $this->assertNotContains($md->id, $this->pivotOf($target->fresh()));

        $this->actingAs($adminMi, 'sanctum')->deleteJson("/api/admin/users/{$target->id}/lembaga", [
            'lembaga_id' => $f['mi']->id,
        ])->assertStatus(200);
        $this->assertNotContains($f['mi']->id, $this->pivotOf($target->fresh()));
    }
}
