<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

// Aturan: tahun ajaran selalu milik lembaga operasional (parent_id NOT NULL);
// root pesantren tidak boleh punya TA, juga sebagai acuan kegiatan PSB.
class TahunAjaranGuardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function baseFixture(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $taMi = TahunAjaran::create([
            'lembaga_id' => $mi->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $super = User::create([
            'name' => 'Super', 'email' => 'super-ta@example.com',
            'phone' => '081000000001', 'password' => 'password',
        ]);
        $super->assignRole('super_admin');

        return compact('root', 'mi', 'taMi', 'super');
    }

    public function test_01_store_ta_root_ditolak_operasional_lolos(): void
    {
        $f = $this->baseFixture();

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/tahun-ajaran', [
            'lembaga_id' => $f['root']->id, 'nama' => '2026/2027',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['lembaga_id']);

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/tahun-ajaran', [
            'lembaga_id' => $f['mi']->id, 'nama' => '2027/2028',
            'tanggal_mulai' => '2027-07-01', 'tanggal_selesai' => '2028-06-30',
        ])->assertStatus(201);
        $this->assertDatabaseHas('tahun_ajaran', ['lembaga_id' => $f['mi']->id, 'nama' => '2027/2028']);
    }

    public function test_02_kegiatan_menolak_ta_root(): void
    {
        $f = $this->baseFixture();
        $taRoot = TahunAjaran::create([
            'lembaga_id' => $f['root']->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/psb/kegiatan', [
            'tahun_ajaran_id' => $taRoot->id, 'nama' => 'PSB Root',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['tahun_ajaran_id']);

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/psb/kegiatan', [
            'tahun_ajaran_id' => $f['taMi']->id, 'nama' => 'PSB 2026/2027',
        ])->assertStatus(201);
    }

    public function test_03_aksi_siklus_menolak_target_root(): void
    {
        $f = $this->baseFixture();
        $santri = Santri::create([
            'lembaga_id' => $f['mi']->id, 'nama_lengkap' => 'Anak Root', 'jk' => 'L', 'status_global' => false,
        ]);

        $this->actingAs($f['super'], 'sanctum')->postJson("/api/admin/santri/{$santri->id}/berhenti-jenjang", [
            'lembaga_id' => $f['root']->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['lembaga_id']);
    }
}
