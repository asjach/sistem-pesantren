<?php

namespace Tests\Feature;

use App\Models\PengaturanHalaman;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PengaturanHalamanTest extends TestCase
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

    public function test_super_admin_dapat_menyimpan_urutan_dan_sembunyi(): void
    {
        $this->actingAs($this->superAdmin())->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'data_induk',
            'urutan' => ['/kelas', '/users'],
            'sembunyi' => ['/referensi'],
        ])->assertOk();

        $row = PengaturanHalaman::where('page_key', 'data_induk')->firstOrFail();
        $this->assertSame(['/kelas', '/users'], $row->urutan);
        $this->assertSame(['/referensi'], $row->sembunyi);
    }

    public function test_menyimpan_lagi_mengganti_isi_bukan_menambah_baris(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'data_induk',
            'urutan' => ['/kelas'],
            'sembunyi' => [],
        ])->assertOk();

        $this->actingAs($admin)->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'data_induk',
            'urutan' => ['/users', '/kelas'],
            'sembunyi' => ['/users'],
        ])->assertOk();

        $this->assertSame(1, PengaturanHalaman::where('page_key', 'data_induk')->count());
        $row = PengaturanHalaman::where('page_key', 'data_induk')->firstOrFail();
        $this->assertSame(['/users', '/kelas'], $row->urutan);
        $this->assertSame(['/users'], $row->sembunyi);
    }

    public function test_urutan_ganda_ditolak_validasi(): void
    {
        // `distinct` menolak rute ganda: lebih baik galat jelas daripada
        // diam-diam dibersihkan (urutan ganda menandakan bug pemanggil).
        $this->actingAs($this->superAdmin())->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'data_induk',
            'urutan' => ['/kelas', '/kelas', '/users'],
            'sembunyi' => [],
        ])->assertJsonValidationErrors(['urutan.1']);
    }

    public function test_mengembalikan_bawaan_menghapus_baris(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'data_induk',
            'urutan' => ['/kelas'],
            'sembunyi' => [],
        ])->assertOk();

        $this->actingAs($admin)
            ->deleteJson('/api/admin/pengaturan-halaman?page_key=data_induk')
            ->assertOk();

        $this->assertSame(0, PengaturanHalaman::where('page_key', 'data_induk')->count());
    }

    public function test_memuat_setelan_beberapa_halaman(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'data_induk',
            'urutan' => ['/kelas'],
            'sembunyi' => [],
        ])->assertOk();

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/pengaturan-halaman?keys[]=data_induk&keys[]=akademik')
            ->assertOk();

        $this->assertSame(['/kelas'], $res->json('data.peta.data_induk.urutan'));
        $this->assertArrayNotHasKey('akademik', $res->json('data.peta'));
    }

    public function test_bukan_super_admin_tidak_boleh_menyimpan(): void
    {
        $user = User::create([
            'name' => 'Guru',
            'email' => 'guru@example.com',
            'phone' => '081234567891',
            'password' => 'password',
        ]);

        $this->actingAs($user)->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'data_induk',
            'urutan' => ['/kelas'],
            'sembunyi' => [],
        ])->assertForbidden();
    }

    public function test_urutan_harus_dikirim(): void
    {
        $this->actingAs($this->superAdmin())->putJson('/api/admin/pengaturan-halaman', [
            'page_key' => 'data_induk',
        ])->assertJsonValidationErrors(['urutan', 'sembunyi']);
    }
}
