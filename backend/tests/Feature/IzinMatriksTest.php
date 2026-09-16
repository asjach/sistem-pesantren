<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Services\IzinKatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class IzinMatriksTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->seq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->seq,
            'email' => "izin_u{$this->seq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9300000000 + $this->seq * 131), 10, '0', STR_PAD_LEFT),
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

    protected function fixtureKelas(): Kelas
    {
        $unik = strtoupper(substr(uniqid(), -5));
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN'.$unik,
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI'.$unik,
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'lembaga_id' => null, 'nama' => '2026/2027 '.$unik,
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        return Kelas::create([
            'lembaga_id' => $mi->id, 'tahun_ajaran_id' => $ta->id,
            'tingkat' => '7', 'nama_kelas' => 'VII-A',
        ]);
    }

    protected function segarkanIzin(User $u): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $u->unsetRelation('permissions')->unsetRelation('roles');
    }

    public function test_01_katalog_sinkron_dengan_db_setelah_seed(): void
    {
        $diDb = Permission::where('guard_name', 'sanctum')
            ->pluck('name')->sort()->values()->all();
        $katalog = collect(IzinKatalog::semua())->sort()->values()->all();

        $this->assertSame($katalog, $diDb);
    }

    public function test_02_bawaan_super_admin_full_admin_tanpa_eksklusif(): void
    {
        $super = Role::findByName('super_admin', 'sanctum');
        $admin = Role::findByName('admin', 'sanctum');

        $this->assertEmpty(array_diff(IzinKatalog::semua(), $super->permissions->pluck('name')->all()));
        foreach (IzinKatalog::EKSKLUSIF_SUPER_ADMIN as $izin) {
            $this->assertFalse($admin->hasPermissionTo($izin), "admin tak boleh punya {$izin}");
        }
        $this->assertTrue($admin->hasPermissionTo('santri.hapus'));
        $this->assertTrue($admin->hasPermissionTo('santri.lihat'));
    }

    public function test_03_matriks_hanya_super_admin(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/izin')->assertStatus(403);
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/izin', [
            'role' => 'admin', 'permissions' => [],
        ])->assertStatus(403);
    }

    public function test_04_role_super_admin_tidak_bisa_diubah(): void
    {
        $super = $this->makeUser('super_admin');

        $this->actingAs($super, 'sanctum')->putJson('/api/admin/izin', [
            'role' => 'super_admin', 'permissions' => [],
        ])->assertStatus(422);
    }

    public function test_05_cabut_izin_menutup_akses_dan_kembalikan_membuka(): void
    {
        $kelas = $this->fixtureKelas();
        $super = $this->makeUser('super_admin');
        $admin = $this->makeUser('admin', [$kelas->lembaga_id]);

        // Bawaan: admin boleh hapus.
        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/kelas/{$kelas->id}")
            ->assertStatus(200);
        $kelas = $this->fixtureKelas();
        DB::table('user_lembaga')->insert([
            'user_id' => $admin->id, 'lembaga_id' => $kelas->lembaga_id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        // Cabut kelas.hapus via matriks.
        $adminRole = Role::findByName('admin', 'sanctum');
        $sisa = $adminRole->permissions->pluck('name')->reject(fn ($p) => $p === 'kelas.hapus')->values()->all();
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/izin', [
            'role' => 'admin', 'permissions' => $sisa,
        ])->assertStatus(200);
        $this->segarkanIzin($admin);

        // Hapus ditutup, baca tetap buka.
        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/kelas/{$kelas->id}")
            ->assertStatus(403);
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/kelas')
            ->assertStatus(200);

        // Kembalikan: hapus terbuka lagi.
        $this->actingAs($super, 'sanctum')->putJson('/api/admin/izin', [
            'role' => 'admin', 'permissions' => array_values(array_unique([...$sisa, 'kelas.hapus'])),
        ])->assertStatus(200);
        $this->segarkanIzin($admin);
        $resAkhir = $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/kelas/{$kelas->id}");
        $resAkhir->assertStatus(200);
    }

    public function test_06_izin_tak_dikenal_dibuang_saat_simpan(): void
    {
        $super = $this->makeUser('super_admin');

        $res = $this->actingAs($super, 'sanctum')->putJson('/api/admin/izin', [
            'role' => 'guru', 'permissions' => ['santri.lihat', 'halaman.fiktif'],
        ])->assertStatus(200);

        $this->assertSame(['santri.lihat'], $res->json('data.permissions'));
    }

    /**
     * Setiap endpoint ber-auth di luar portal/kamus/publik wajib punya
     * middleware `permission:` — route admin baru tanpa izin = suite merah.
     */
    public function test_07_semua_route_admin_bermiddleware_permission(): void
    {
        $terkecuali = ['api/auth', 'api/portal', 'api/kamus', 'api/psb/opsi', 'api/psb/cek-nik', 'api/psb/daftar', 'api/psb/daftar-paket'];
        $tanpaIzin = [];
        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();
            $mw = $route->gatherMiddleware();
            if (! in_array('auth:sanctum', $mw, true)) {
                continue;
            }
            $skip = false;
            foreach ($terkecuali as $prefix) {
                if (str_starts_with($uri, $prefix)) {
                    $skip = true;
                    break;
                }
            }
            if ($skip) {
                continue;
            }
            $ada = collect($mw)->contains(fn ($m) => is_string($m) && str_starts_with($m, 'permission:'));
            if (! $ada) {
                $tanpaIzin[] = implode('|', $route->methods())." {$uri}";
            }
        }

        $this->assertSame([], $tanpaIzin);
    }
}
