<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\Pegawai;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

class SkTigaLevelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
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

    public function test_sk_tiga_level_crud_dan_duplikasi_antar_lembaga(): void
    {
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        Lembaga::create(['nama' => 'MTs', 'jenjang' => 'MTs', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);
        $auth = $this->superAdmin();

        // Level 1: SK awal pegawai (global).
        $res = $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai', [
            'nama_lengkap' => 'Guru SK',
            'jenis_kelamin' => 'L',
            'tgl_mulai_kerja' => '2010-07-01',
            'no_sk_awal' => 'SK/001/2010',
            'tgl_sk_awal' => '2010-07-01',
        ])->assertCreated();
        $pegawaiId = $res->json('data.id');
        $this->assertSame('SK/001/2010', Pegawai::find($pegawaiId)->no_sk_awal);

        // Cari via nomor SK.
        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai?q=SK/001')
            ->assertOk()->assertJsonFragment(['no_sk_awal' => 'SK/001/2010']);

        // Level 2: SK awal PTK per jenjang.
        foreach (['MI', 'MTs'] as $jenjang) {
            $this->actingAs($auth, 'sanctum')->postJson("/api/admin/pegawai/{$pegawaiId}/tempatkan", [
                'jenjang' => $jenjang,
                'tugas_utama' => $jenjang === 'MI' ? 'TU' : 'Guru Pengampu',
                'tgl_masuk' => '2012-07-01',
                'no_sk_awal_ptk' => "SK-PTK/{$jenjang}/2012",
                'tgl_sk_awal_ptk' => '2012-07-01',
            ])->assertCreated();
        }

        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai-lembaga?q=SK-PTK/MI')
            ->assertOk()->assertJsonFragment(['no_sk_awal_ptk' => 'SK-PTK/MI/2012']);

        // Level 3: SK tahunan — satu fisik SK untuk 2 lembaga (nomor sama).
        foreach (['MI', 'MTs'] as $jenjang) {
            $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai-keaktifan', [
                'pegawai_id' => $pegawaiId,
                'jenjang' => $jenjang,
                'tahun_ajaran' => '2026/2027',
                'no_sk' => 'SK-TA/2026/001',
                'tgl_sk' => '2026-07-01',
            ])->assertCreated();
        }

        $this->actingAs($auth, 'sanctum')->getJson('/api/admin/pegawai-keaktifan?q=SK-TA/2026')
            ->assertOk()->assertJsonFragment(['no_sk' => 'SK-TA/2026/001']);

        // Update salah satu baris tanpa kirim SK → SK lama dipertahankan.
        $this->actingAs($auth, 'sanctum')->postJson('/api/admin/pegawai-keaktifan', [
            'pegawai_id' => $pegawaiId,
            'jenjang' => 'MI',
            'tahun_ajaran' => '2026/2027',
            'tugas_utama' => 'TU',
        ])->assertCreated()->assertJsonFragment(['no_sk' => 'SK-TA/2026/001']);
    }
}
