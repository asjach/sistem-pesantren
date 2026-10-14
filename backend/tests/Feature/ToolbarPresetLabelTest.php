<?php

namespace Tests\Feature;

use App\Models\ToolbarPreset;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Label kolom kini milik TABEL (bukan preset): tetap walau preset berganti,
 * sejalan dengan perataan.
 */
class ToolbarPresetLabelTest extends TestCase
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

    public function test_label_disimpan_per_tabel(): void
    {
        $this->actingAs($this->superAdmin())->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'label' => ['nama_lengkap' => 'Nama Santri', 'nis' => 'NIS'],
        ])->assertOk();

        $row = ToolbarPreset::where('table_key', 'santri')->firstOrFail();
        $this->assertSame(['nama_lengkap' => 'Nama Santri', 'nis' => 'NIS'], $row->label);
    }

    public function test_label_kosong_dihapus_kembali_ke_bawaan(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'label' => ['nama_lengkap' => 'Nama Santri'],
        ])->assertOk();

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'label' => ['nama_lengkap' => '   '],
        ])->assertOk();

        $this->assertNull(ToolbarPreset::where('table_key', 'santri')->firstOrFail()->label);
    }

    public function test_label_tidak_menimpa_align_yang_sudah_ada(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'align' => ['nis' => 'right'],
        ])->assertOk();

        // Simpan label saja: align harus tetap (upsert gabung per kunci).
        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'label' => ['nis' => 'Nomor Induk'],
        ])->assertOk();

        $row = ToolbarPreset::where('table_key', 'santri')->firstOrFail();
        $this->assertSame(['nis' => 'right'], $row->align);
        $this->assertSame(['nis' => 'Nomor Induk'], $row->label);
    }

    public function test_label_dibatasi_100_karakter(): void
    {
        $this->actingAs($this->superAdmin())->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'label' => ['nis' => str_repeat('a', 150)],
        ])->assertJsonValidationErrors(['label.nis']);
    }

    public function test_bukan_super_admin_tidak_boleh_menyimpan_label(): void
    {
        $user = User::create([
            'name' => 'Guru',
            'email' => 'guru@example.com',
            'phone' => '081234567891',
            'password' => 'password',
        ]);

        $this->actingAs($user)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'label' => ['nis' => 'Nomor Induk'],
        ])->assertForbidden();
    }
}
