<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\ToolbarPreset;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Visibilitas toolbar global per table_key: baca bebas semua admin, tulis
 * khusus super_admin, kunci kontrol tak dikenal dan nilai non-boolean
 * ditolak.
 */
class ToolbarPresetTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->seq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->seq,
            'email' => "toolbar_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0815'.str_pad((string) (40000000 + $this->seq), 8, '0', STR_PAD_LEFT),
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

    public function test_baca_bebas_tulis_super_admin_saja(): void
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $pusat = $this->makeUser('super_admin');
        $scoped = $this->makeUser('admin', [$mi->id]);

        // Belum ada baris: visibilitas kosong (semua tampil).
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.visibilitas', []);

        // Admin lembaga ditolak menulis (403), baris tak terbentuk.
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['cari' => false],
        ])->assertStatus(403);
        $this->assertSame(0, ToolbarPreset::where('table_key', 'santri')->count());

        // Super_admin menyimpan + membaca kembali.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['cari' => false, 'kolom' => true, 'filter' => false],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.visibilitas', ['cari' => false, 'kolom' => true, 'filter' => false]);

        // Admin lembaga ditolak menghapus; super_admin mengembalikan bawaan.
        $this->actingAs($scoped, 'sanctum')
            ->deleteJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(403);
        $this->actingAs($pusat, 'sanctum')
            ->deleteJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200);
        $this->assertSame(0, ToolbarPreset::where('table_key', 'santri')->count());
    }

    public function test_validasi_kunci_dan_nilai(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['cari' => 'ya'],
        ])->assertStatus(422)->assertJsonValidationErrors(['visibilitas.cari']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['tombol_asing' => true],
        ])->assertStatus(422)->assertJsonValidationErrors(['visibilitas']);
    }

    public function test_simpan_dan_baca_lebar_kontrol(): void
    {
        $pusat = $this->makeUser('super_admin');

        // Tanpa baris: lebar kosong (frontend memakai bawaan px).
        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', []);

        // Simpan lebar + visibilitas sekaligus.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['cari' => true],
            'lebar' => ['cari' => 200, 'urut' => 150, 'kolom' => 176],
        ])->assertStatus(200);
        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', ['cari' => 200, 'urut' => 150, 'kolom' => 176]);

        // Kunci lebar tak dikenal + di luar rentang ditolak.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['cari' => true],
            'lebar' => ['info' => 100],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar']);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['cari' => true],
            'lebar' => ['cari' => 10],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar.cari']);
    }
}
