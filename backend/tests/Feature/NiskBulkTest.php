<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Generate NISK massal: hanya baris layak (NIS lokal ada, NISK kosong,
 * bukan MD); kegagalan per baris tak menggagalkan bulk; filter halaman
 * diikuti; non-ubah ditolak.
 */
class NiskBulkTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    protected function makeUser(string $role): User
    {
        $u = User::create([
            'name' => ucfirst($role), 'email' => "nisk_{$role}_".uniqid().'@example.com',
            'phone' => '08'.random_int(1000000000, 9999999999), 'password' => 'password',
        ]);
        $u->assignRole($role);

        return $u;
    }

    /** MI (NSM valid) + MD; baris layak, sudah-ada, tanpa-nis-lokal, dan MD. */
    protected function fixture(): array
    {
        $root = Lembaga::create(['nama' => 'Pesantren', 'jenjang' => 'PESANTREN', 'is_active' => true]);
        $mi = Lembaga::create([
            'nama' => 'MI', 'jenjang' => 'MI',
            'nsm' => '123456789012', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'nama' => 'MD', 'jenjang' => 'MD',
            'nsm' => '123456789013', 'is_active' => true,
        ]);

        $layak = Santri::create(['nama_lengkap' => 'Layak', 'jk' => 'L']);
        $sudah = Santri::create(['nama_lengkap' => 'Sudah', 'jk' => 'L']);
        $kosong = Santri::create(['nama_lengkap' => 'Kosong', 'jk' => 'L']);
        $anakMd = Santri::create(['nama_lengkap' => 'Anak MD', 'jk' => 'L']);

        LembagaSantri::create([
            'santri_id' => $layak->id, 'jenjang' => $mi->jenjang,
            'nis_lokal' => '200', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2025-07-01',
        ]);
        LembagaSantri::create([
            'santri_id' => $sudah->id, 'jenjang' => $mi->jenjang,
            'nis_lokal' => '201', 'nis_kemenag' => 'lama', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2025-07-01',
        ]);
        LembagaSantri::create([
            'santri_id' => $kosong->id, 'jenjang' => $mi->jenjang,
            'nis_lokal' => null, 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2025-07-01',
        ]);
        LembagaSantri::create([
            'santri_id' => $anakMd->id, 'jenjang' => $md->jenjang,
            'nis_lokal' => '300', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2025-07-01',
        ]);

        return compact('mi', 'md', 'layak');
    }

    public function test_bulk_hanya_baris_layak_non_md(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');

        $res = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/lembaga-santri/generate-nisk-bulk', [])
            ->assertStatus(200);

        $this->assertSame(1, $res->json('data.berhasil'));
        // NSM + YY(tgl_masuk 2025) + 4 digit akhir NIS lokal.
        $this->assertSame(
            '123456789012250200',
            LembagaSantri::where('santri_id', $f['layak']->id)->value('nis_kemenag')
        );
        $this->assertSame('lama', LembagaSantri::where('nis_lokal', '201')->value('nis_kemenag'));
        $this->assertNull(LembagaSantri::where('nis_lokal', '300')->value('nis_kemenag'));

        // Idempoten: jalan kedua tak ada yang diproses.
        $ulang = $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/lembaga-santri/generate-nisk-bulk', [])
            ->assertStatus(200);
        $this->assertSame(0, $ulang->json('data.berhasil'));
    }

    public function test_daftar_urut_join_tidak_ambigu_dengan_filter(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');

        // Urut nama (join santri) + filter lembaga & is_active (join lembaga
        // bila urut lembaga) — 1052 bila tak terkualifikasi.
        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/lembaga-santri?jenjang='.$f['mi']->jenjang.'&is_active=1&sort=nama&arah=naik')
            ->assertStatus(200)
            ->assertJsonPath('data.0.santri.nama_lengkap', 'Kosong');
        $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/lembaga-santri?jenjang='.$f['mi']->jenjang.'&is_active=1&sort=lembaga&arah=naik')
            ->assertStatus(200)
            ->assertJsonCount(3, 'data');
    }

    public function test_bulk_mengikuti_filter_dan_izin(): void
    {
        $f = $this->fixture();
        $super = $this->makeUser('super_admin');
        $guru = $this->makeUser('guru');

        // Filter lembaga MD saja → nol (MD dilewati).
        $this->actingAs($super, 'sanctum')
            ->postJson('/api/admin/lembaga-santri/generate-nisk-bulk', ['jenjang' => $f['md']->jenjang])
            ->assertStatus(200)
            ->assertJsonPath('data.berhasil', 0);

        // Tanpa izin ubah → 403.
        $this->actingAs($guru, 'sanctum')
            ->postJson('/api/admin/lembaga-santri/generate-nisk-bulk', [])
            ->assertStatus(403);
    }
}
