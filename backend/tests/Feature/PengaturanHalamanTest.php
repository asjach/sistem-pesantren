<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\PengaturanHalaman;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Visibilitas filter topBar global per page_key: baca bebas semua admin,
 * tulis khusus super_admin, kunci filter tak dikenal dan nilai
 * non-boolean ditolak.
 */
class PengaturanHalamanTest extends TestCase
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
            'email' => "halaman_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0815'.str_pad((string) (40000000 + $this->seq), 8, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    public function test_baca_bebas_tulis_super_admin_saja(): void
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $pusat = $this->makeUser('super_admin');
        $scoped = $this->makeUser('admin', [$mi->jenjang]);

        // Belum ada baris: filter kosong (ikut bawaan kode halaman).
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/pengaturan-halaman?page_key=daftar_kelas')
            ->assertStatus(200)
            ->assertJsonPath('data.filter', []);

        // Admin lembaga ditolak menulis (403), baris tak terbentuk.
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'daftar_kelas',
            'filter' => ['tingkat' => false],
        ])->assertStatus(403);
        $this->assertSame(0, PengaturanHalaman::where('page_key', 'daftar_kelas')->count());

        // Super_admin menyimpan + membaca kembali.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'daftar_kelas',
            'filter' => ['tingkat' => false, 'kelas' => true, 'semester' => false],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/pengaturan-halaman?page_key=daftar_kelas')
            ->assertStatus(200)
            ->assertJsonPath('data.filter', ['tingkat' => false, 'kelas' => true, 'semester' => false]);

        // Simpan parsial tak menghapus kunci lain.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'daftar_kelas',
            'filter' => ['lembaga' => false],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/pengaturan-halaman?page_key=daftar_kelas')
            ->assertStatus(200)
            ->assertJsonPath('data.filter', ['tingkat' => false, 'kelas' => true, 'semester' => false, 'lembaga' => false]);

        // Admin lembaga ditolak menghapus; super_admin mengembalikan bawaan.
        $this->actingAs($scoped, 'sanctum')
            ->deleteJson('/api/admin/pengaturan-halaman?page_key=daftar_kelas')
            ->assertStatus(403);
        $this->actingAs($pusat, 'sanctum')
            ->deleteJson('/api/admin/pengaturan-halaman?page_key=daftar_kelas')
            ->assertStatus(200);
        $this->assertSame(0, PengaturanHalaman::where('page_key', 'daftar_kelas')->count());
    }

    public function test_validasi_kunci_dan_nilai(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'daftar_kelas',
            'filter' => ['tingkat' => 'ya'],
        ])->assertStatus(422)->assertJsonValidationErrors(['filter.tingkat']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'daftar_kelas',
            'filter' => ['filter_asing' => true],
        ])->assertStatus(422)->assertJsonValidationErrors(['filter']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'daftar_kelas',
        ])->assertStatus(422)->assertJsonValidationErrors(['page_key']);
    }
}
