<?php

namespace Tests\Feature;

use App\Models\ToolbarPreset;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Info tabel (`toolbar_preset.info_html`): HTML ter-sanitasi allowlist yang
 * dirender di bilah judul SETIAP tabel lewat HoverCard.
 *
 * Yang diuji di sini bukan detail allowlist-nya (itu `HtmlInfoBersihkanTest`),
 * melainkan kontrak endpoint: siapa boleh menulis, bahwa isinya benar-benar
 * melewati sanitasi sebelum menyentuh DB, dan bahwa mengosongkan info
 * menghapus override-nya (bukan menyimpan string kosong).
 */
class ToolbarPresetInfoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function user(string $role, string $email): User
    {
        $user = User::create([
            'name' => 'Uji Info',
            'email' => $email,
            'phone' => '0812'.substr((string) crc32($email), 0, 8),
            'password' => 'password',
        ]);
        $user->assignRole($role);

        return $user;
    }

    public function test_info_disimpan_dan_dibaca_kembali(): void
    {
        $admin = $this->user('super_admin', 'info_super@example.com');

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'info_html' => '<p>Ketentuan <strong>uji</strong>.</p>',
        ])->assertOk();

        $this->assertSame(
            '<p>Ketentuan <strong>uji</strong>.</p>',
            ToolbarPreset::where('table_key', 'santri')->value('info_html'),
        );

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertOk();

        $this->assertSame('<p>Ketentuan <strong>uji</strong>.</p>', $res->json('data.info_html'));
    }

    /** Tabel tanpa info = null, supaya frontend menyembunyikan tombol Info. */
    public function test_tabel_tanpa_info_memberi_null(): void
    {
        $admin = $this->user('super_admin', 'info_kosong@example.com');

        $this->actingAs($admin)
            ->getJson('/api/admin/toolbar-preset?table_key=jadwal')
            ->assertOk()
            ->assertJsonPath('data.info_html', null);
    }

    /** Kosong = hapus info, bukan menyimpan string kosong. */
    public function test_info_kosong_menghapus_override(): void
    {
        $admin = $this->user('super_admin', 'info_hapus@example.com');

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'info_html' => '<p>ada</p>',
        ])->assertOk();

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'info_html' => '',
        ])->assertOk();

        $this->assertNull(ToolbarPreset::where('table_key', 'santri')->value('info_html'));
    }

    /**
     * Guard keamanan utama: HTML dari editor SEBELUM disimpan. Tanpa ini
     * satu `<img onerror>` akan dieksekusi di bilah judul setiap tabel yang
     * dibuka setiap pengguna.
     */
    public function test_markup_berbahaya_dibuang_sebelum_disimpan(): void
    {
        $admin = $this->user('super_admin', 'info_xss@example.com');

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'info_html' => '<p>ok</p><script>alert(1)</script>'
                .'<img src="x" onerror="alert(2)">'
                .'<a href="javascript:alert(3)">jebakan</a>',
        ])->assertOk();

        $tersimpan = ToolbarPreset::where('table_key', 'santri')->value('info_html');

        $this->assertSame('<p>ok</p><img><a rel="noopener noreferrer nofollow">jebakan</a>', $tersimpan);
        $this->assertStringNotContainsString('onerror', (string) $tersimpan);
        $this->assertStringNotContainsString('javascript:', (string) $tersimpan);
    }

    /** Gambar base64 yang sah tetap utuh — sanitasi tak boleh killing-nya. */
    public function test_gambar_base64_tetap_utuh(): void
    {
        $admin = $this->user('super_admin', 'info_gambar@example.com');
        $png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'info_html' => '<p>denah</p><img src="'.$png.'" alt="Denah Madrasah">',
        ])->assertOk();

        $tersimpan = (string) ToolbarPreset::where('table_key', 'santri')->value('info_html');

        $this->assertStringContainsString($png, $tersimpan);
        $this->assertStringContainsString('alt="Denah Madrasah"', $tersimpan);
    }

    /** Info dibaca semua pengguna, ditulis hanya super_admin. */
    public function test_hanya_super_admin_yang_menulis(): void
    {
        $admin = $this->user('admin', 'info_biasa@example.com');

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'info_html' => '<p>bukan wewenang</p>',
        ])->assertStatus(403);

        $this->assertNull(ToolbarPreset::where('table_key', 'santri')->value('info_html'));
    }

    /** Info tak boleh menimpa setelan lain saat disimpan (upsert gabung). */
    public function test_info_tidak_menimpa_setelan_lain(): void
    {
        $admin = $this->user('super_admin', 'info_gabung@example.com');

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'judul' => 'Buku Induk',
        ])->assertOk();
        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'info_html' => '<p>info</p>',
        ])->assertOk();

        $baris = ToolbarPreset::where('table_key', 'santri')->first();
        $this->assertSame('Buku Induk', $baris?->judul);
        $this->assertSame('<p>info</p>', $baris?->info_html);
    }

    /** Hanya `info_html` yang dikirim = sah (tak butuh setelan lain). */
    public function test_info_saja_sah_tanpa_setelan_lain(): void
    {
        $admin = $this->user('super_admin', 'info_saja@example.com');

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'jadwal',
            'info_html' => '<p>cukup ini</p>',
        ])->assertOk()
            ->assertJsonPath('data.info_html', '<p>cukup ini</p>');
    }

    /** Payload raksasa ditolak validasi sebelum masuk parser. */
    public function test_info_terlalu_besar_ditolak(): void
    {
        $admin = $this->user('super_admin', 'info_besar@example.com');

        $this->actingAs($admin)->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'info_html' => str_repeat('a', 1500001),
        ])->assertStatus(422)->assertJsonValidationErrors('info_html');
    }
}
