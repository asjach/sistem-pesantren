<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

/**
 * Sort daftar keanggotaan: param sort (daftar nilai allowlist) + arah global.
 */
class KeanggotaanSortTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function makeSuperAdmin(): User
    {
        $u = User::create([
            'name' => 'Super',
            'email' => 'super_urut_'.uniqid().'@example.com',
            'phone' => '081200000099',
            'password' => 'password',
        ]);
        $u->assignRole('super_admin');

        return $u;
    }

    /** Fixture 3 baris: nama acak + jk campuran + nis berjenjang. */
    protected function sebaris(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);

        $ahmad = Santri::create(['nama_lengkap' => 'Ahmad', 'jk' => 'P']);
        $budi = Santri::create(['nama_lengkap' => 'Budi', 'jk' => 'L']);
        $candra = Santri::create(['nama_lengkap' => 'Candra', 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $ahmad->id, 'lembaga_id' => $md->id,
            'nis_lokal' => '100', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2025-07-01',
        ]);
        LembagaSantri::create([
            'santri_id' => $budi->id, 'lembaga_id' => $mi->id,
            'nis_lokal' => '200', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2025-07-01',
        ]);
        LembagaSantri::create([
            'santri_id' => $candra->id, 'lembaga_id' => $mi->id,
            'nis_lokal' => '300', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2025-07-01',
        ]);

        return compact('mi', 'md');
    }

    protected function namaUrutan(User $super, string $query): array
    {
        $res = $this->actingAs($super, 'sanctum')
            ->getJson("/api/admin/lembaga-santri?per_page=50{$query}")
            ->assertStatus(200);

        return array_column(array_column($res->json('data'), 'santri'), 'nama_lengkap');
    }

    public function test_urut_nama_naik(): void
    {
        $this->sebaris();
        $this->assertSame(
            ['Ahmad', 'Budi', 'Candra'],
            $this->namaUrutan($this->makeSuperAdmin(), '&sort=nama&arah=naik')
        );
    }

    public function test_urut_ganda_jk_lalu_nama(): void
    {
        $this->sebaris();
        $this->assertSame(
            ['Budi', 'Candra', 'Ahmad'],
            $this->namaUrutan($this->makeSuperAdmin(), '&sort=jk,nama&arah=naik')
        );
    }

    public function test_urut_nis_turun(): void
    {
        $this->sebaris();
        $this->assertSame(
            ['Candra', 'Budi', 'Ahmad'],
            $this->namaUrutan($this->makeSuperAdmin(), '&sort=nis_lokal&arah=turun')
        );
    }

    public function test_tanpa_sort_memakai_urutan_lama(): void
    {
        $this->sebaris();
        $this->assertSame(
            ['Candra', 'Budi', 'Ahmad'],
            $this->namaUrutan($this->makeSuperAdmin(), '')
        );
    }

    public function test_nilai_liar_ditolak(): void
    {
        $this->sebaris();
        $this->actingAs($this->makeSuperAdmin(), 'sanctum')
            ->getJson('/api/admin/lembaga-santri?sort=password')
            ->assertStatus(422);
    }

    public function test_lebih_dari_tiga_kunci_ditolak(): void
    {
        $this->sebaris();
        $this->actingAs($this->makeSuperAdmin(), 'sanctum')
            ->getJson('/api/admin/lembaga-santri?sort=nama,jk,lembaga,nis_lokal')
            ->assertStatus(422);
    }
}
