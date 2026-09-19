<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\SemesterAktif;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Semester aktif per lembaga: daftar + tetapkan Ganjil/Genap.
 * Tulis = super_admin semua, admin untuk lembaganya.
 */
class SemesterAktifTest extends TestCase
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
            'email' => "sem{$this->seq}_".uniqid().'@example.com',
            'phone' => '0817'.str_pad((string) (50000000 + $this->seq), 8, '0', STR_PAD_LEFT),
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

    /** @return array{root: Lembaga, mi: Lembaga, md: Lembaga, mts: Lembaga} */
    protected function lembaga(): array
    {
        $root = Lembaga::create(['nama' => 'Pesantren', 'kode' => 'PESANTREN', 'is_active' => true]);
        $mi = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI', 'is_active' => true]);
        $md = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD', 'is_active' => true]);
        $mts = Lembaga::create(['parent_id' => $root->id, 'nama' => 'Madrasah Tsanawiyah', 'kode' => 'MTS', 'is_active' => true]);

        return ['root' => $root, 'mi' => $mi, 'md' => $md, 'mts' => $mts];
    }

    public function test_daftar_dan_tetapkan_semester(): void
    {
        $l = $this->lembaga();
        $pusat = $this->makeUser('super_admin');

        // Awal: semua belum diatur, root tak ikut daftar.
        $this->actingAs($pusat, 'sanctum')->getJson('/api/admin/semester-aktif')
            ->assertStatus(200)
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.semester', null);

        // Tetapkan MI = Ganjil.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/semester-aktif', [
            'lembaga_id' => $l['mi']->id, 'semester' => '1',
        ])->assertStatus(200)
            ->assertJsonPath('data.label', 'Ganjil');

        $this->assertSame('1', SemesterAktif::where('lembaga_id', $l['mi']->id)->value('semester'));

        // Nilai lain ditolak; root ditolak (bukan operasional).
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/semester-aktif', [
            'lembaga_id' => $l['mi']->id, 'semester' => '3',
        ])->assertStatus(422);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/semester-aktif', [
            'lembaga_id' => $l['root']->id, 'semester' => '1',
        ])->assertStatus(422);
    }

    public function test_admin_hanya_lembaganya(): void
    {
        $l = $this->lembaga();
        $adminMi = $this->makeUser('admin', [$l['mi']->id]);

        // Daftar: MI + pasangan MD; MTS di luar jangkauan.
        $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/semester-aktif')
            ->assertStatus(200)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.lembaga_id', $l['mi']->id);

        // Milik sendiri boleh, MTS ditolak.
        $this->actingAs($adminMi, 'sanctum')->putJson('/api/admin/semester-aktif', [
            'lembaga_id' => $l['mi']->id, 'semester' => '2',
        ])->assertStatus(200)->assertJsonPath('data.label', 'Genap');
        $this->actingAs($adminMi, 'sanctum')->putJson('/api/admin/semester-aktif', [
            'lembaga_id' => $l['mts']->id, 'semester' => '2',
        ])->assertStatus(403);
    }

    public function test_guru_tanpa_izin_ditolak(): void
    {
        $this->lembaga();
        $guru = $this->makeUser('guru');

        $this->actingAs($guru, 'sanctum')->getJson('/api/admin/semester-aktif')->assertStatus(403);
    }
}
