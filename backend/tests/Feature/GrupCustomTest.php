<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GrupCustomTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2025/2026']);
    }

    protected function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    public function test_crud_grup_dan_anggota(): void
    {
        $admin = $this->admin();
        $s1 = Santri::create(['nama_lengkap' => 'Ekskul Satu', 'jk' => 'L']);
        $s2 = Santri::create(['nama_lengkap' => 'Ekskul Dua', 'jk' => 'P']);

        // Buat grup.
        $grup = $this->actingAs($admin)->postJson('/api/admin/keuangan/grup-custom', [
            'nama' => 'Ekskul Matematika', 'keterangan' => 'Peserta olimpiade',
        ])->assertStatus(201)->json();
        $this->assertSame('Ekskul Matematika', $grup['nama']);
        $this->assertSame([], $grup['santri']);

        // Nama wajib unik.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/grup-custom', [
            'nama' => 'Ekskul Matematika',
        ])->assertStatus(422)->assertJsonValidationErrors('nama');

        // Tambah anggota (idempotent).
        $isi = fn () => $this->actingAs($admin)->getJson('/api/admin/keuangan/grup-custom')
            ->assertStatus(200)->json();
        $this->actingAs($admin)->postJson("/api/admin/keuangan/grup-custom/{$grup['id']}/anggota", [
            'santri_ids' => [$s1->id, $s2->id],
        ])->assertStatus(200);
        $this->actingAs($admin)->postJson("/api/admin/keuangan/grup-custom/{$grup['id']}/anggota", [
            'santri_ids' => [$s1->id],
        ])->assertStatus(200);
        $daftar = $isi();
        $this->assertCount(1, $daftar);
        $this->assertEqualsCanonicalizing([$s1->id, $s2->id], array_column($daftar[0]['santri'], 'id'));

        // Santri tak dikenal ditolak.
        $this->actingAs($admin)->postJson("/api/admin/keuangan/grup-custom/{$grup['id']}/anggota", [
            'santri_ids' => [999999],
        ])->assertStatus(422);

        // Ubah nama.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/grup-custom/{$grup['id']}", [
            'nama' => 'Ekskul MTK', 'keterangan' => null,
        ])->assertStatus(200)->assertJsonPath('nama', 'Ekskul MTK');

        // Keluarkan satu anggota.
        $this->actingAs($admin)
            ->deleteJson("/api/admin/keuangan/grup-custom/{$grup['id']}/anggota/{$s1->id}")
            ->assertStatus(200);
        $daftar = $isi();
        $this->assertSame([$s2->id], array_column($daftar[0]['santri'], 'id'));

        // Hapus grup → anggota ikut bersih.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/grup-custom/{$grup['id']}")
            ->assertStatus(200)->assertJson(['pesan' => 'Grup dihapus.']);
        $this->assertSame([], $isi());
        $this->assertDatabaseMissing('anggota_grup_santri_custom', ['grup_id' => $grup['id']]);
    }
}
