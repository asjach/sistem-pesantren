<?php

namespace Tests\Feature;

use App\Models\ToolbarPreset;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Judul tabel bisa diisi lewat UI (Kelola Tabel), per TABEL — sama seperti
 * label kolom. Kosong/null berarti kembali ke judul bawaan kode, jadi
 * mengosongkan input tidak pernah menghasilkan judul kosong.
 */
class ToolbarPresetJudulTest extends TestCase
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

    public function test_judul_disimpan_dan_dibaca_kembali(): void
    {
        $admin = $this->superAdmin();

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'judul' => 'Buku Induk Santri',
        ])->assertOk();

        $this->assertSame('Buku Induk Santri', ToolbarPreset::where('table_key', 'santri')->value('judul'));

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertOk();

        $this->assertSame('Buku Induk Santri', $res->json('data.judul'));
    }

    /** Kosong = hapus override, bukan menyimpan judul kosong. */
    public function test_judul_kosong_kembali_ke_bawaan(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'judul' => 'Buku Induk Santri',
        ])->assertOk();

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'judul' => '   ',
        ])->assertOk();

        $this->assertNull(ToolbarPreset::where('table_key', 'santri')->value('judul'));
    }

    /** Tanpa baris tersimpan, judul null = frontend pakai judul bawaan kode. */
    public function test_judul_bawaan_null_bila_belum_diatur(): void
    {
        $res = $this->actingAs($this->superAdmin())
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertOk();

        $this->assertNull($res->json('data.judul'));
    }

    /** Judul tidak mengganggu setelan tabel lain (upsert gabung per kunci). */
    public function test_judul_tidak_menimpa_visibilitas_yang_sudah_ada(): void
    {
        $admin = $this->superAdmin();
        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['judul_tabel' => false],
        ])->assertOk();

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'judul' => 'Buku Induk',
        ])->assertOk();

        $row = ToolbarPreset::where('table_key', 'santri')->firstOrFail();
        $this->assertSame(['judul_tabel' => false], $row->visibilitas);
        $this->assertSame('Buku Induk', $row->judul);
    }

    public function test_judul_dibatasi_100_karakter(): void
    {
        $this->actingAs($this->superAdmin())->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'judul' => str_repeat('a', 150),
        ])->assertJsonValidationErrors(['judul']);
    }

    public function test_bukan_super_admin_tidak_boleh_menyimpan_judul(): void
    {
        $user = User::create([
            'name' => 'Guru',
            'email' => 'guru@example.com',
            'phone' => '081234567891',
            'password' => 'password',
        ]);

        $this->actingAs($user)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'judul' => 'Buku Induk',
        ])->assertForbidden();
    }
}
