<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Samakan NIS paket MI↔MD: pratinjau + eksekusi dua arah, lewati beda/tabrakan.
 */
class SamakanNisTest extends TestCase
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

        return compact('root', 'mi', 'md');
    }

    protected function makeAdmin(array $lembagaIds): User
    {
        $u = User::create([
            'name' => 'Admin Samakan',
            'email' => 'samakan_'.uniqid().'@example.com',
            'phone' => '08'.str_pad((string) random_int(9000000000, 9299999999), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole('admin');
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'lembaga_id' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function anggota(Santri $s, int $lembagaId, ?string $nis): void
    {
        LembagaSantri::create([
            'santri_id' => $s->id, 'lembaga_id' => $lembagaId,
            'nis_lokal' => $nis, 'is_active' => true,
        ]);
    }

    protected function panggil(User $admin, bool $periksa = true)
    {
        return $this->actingAs($admin, 'sanctum')->postJson('/api/admin/santri/samakan-nis', [
            'periksa' => $periksa,
        ]);
    }

    public function test_periksa_tanpa_menulis_dan_eksekusi_menyalin_dua_arah(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id, $f['md']->id]);

        $a = Santri::create(['nama_lengkap' => 'Ganda A', 'jk' => 'L']);
        $this->anggota($a, $f['mi']->id, '27001');
        $this->anggota($a, $f['md']->id, null);

        $b = Santri::create(['nama_lengkap' => 'Ganda B', 'jk' => 'P']);
        $this->anggota($b, $f['mi']->id, null);
        $this->anggota($b, $f['md']->id, '27002');

        $res = $this->panggil($admin, true)->assertStatus(200);
        $this->assertSame(2, (int) $res->json('ringkasan.disamakan'));
        // Pratinjau tidak menulis.
        $this->assertNull(LembagaSantri::where('santri_id', $a->id)->where('lembaga_id', $f['md']->id)->firstOrFail()->nis_lokal);

        $this->panggil($admin, false)->assertStatus(200);
        $this->assertSame('27001', LembagaSantri::where('santri_id', $a->id)->where('lembaga_id', $f['md']->id)->firstOrFail()->nis_lokal);
        $this->assertSame('27002', LembagaSantri::where('santri_id', $b->id)->where('lembaga_id', $f['mi']->id)->firstOrFail()->nis_lokal);
    }

    public function test_beda_dua_sisi_dilaporkan_tanpa_disentuh(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id, $f['md']->id]);

        $s = Santri::create(['nama_lengkap' => 'Beda', 'jk' => 'L']);
        $this->anggota($s, $f['mi']->id, '27101');
        $this->anggota($s, $f['md']->id, '27201');

        $res = $this->panggil($admin, false)->assertStatus(200);
        $this->assertSame(0, (int) $res->json('ringkasan.disamakan'));
        $this->assertSame(1, (int) $res->json('ringkasan.beda'));
        $this->assertSame('27101', LembagaSantri::where('santri_id', $s->id)->where('lembaga_id', $f['mi']->id)->firstOrFail()->nis_lokal);
    }

    public function test_tabrakan_dilewati(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->id, $f['md']->id]);

        $pemilik = Santri::create(['nama_lengkap' => 'Pemilik', 'jk' => 'L']);
        $this->anggota($pemilik, $f['md']->id, '27301');

        $s = Santri::create(['nama_lengkap' => 'Korban', 'jk' => 'L']);
        $this->anggota($s, $f['mi']->id, '27301');
        $this->anggota($s, $f['md']->id, null);

        $res = $this->panggil($admin, false)->assertStatus(200);
        $this->assertSame(1, (int) $res->json('ringkasan.tabrakan'));
        $this->assertNull(LembagaSantri::where('santri_id', $s->id)->where('lembaga_id', $f['md']->id)->firstOrFail()->nis_lokal);
    }

    public function test_luar_lingkup_dikecualikan_dan_tanpa_izin_ditolak(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeAdmin([$f['mi']->id]);

        $s = Santri::create(['nama_lengkap' => 'Luar', 'jk' => 'L']);
        $this->anggota($s, $f['mi']->id, '27401');
        $this->anggota($s, $f['md']->id, null);

        // Admin MI saja tak bisa menulis MD → kandidat dikecualikan.
        $res = $this->panggil($adminMi, false)->assertStatus(200);
        $this->assertSame(0, (int) $res->json('ringkasan.disamakan'));
        $this->assertNull(LembagaSantri::where('santri_id', $s->id)->where('lembaga_id', $f['md']->id)->firstOrFail()->nis_lokal);

        $tanpaIzin = User::create([
            'name' => 'Tanpa Izin', 'email' => 'tanpa_'.uniqid().'@example.com',
            'phone' => '089000000002', 'password' => 'password',
        ]);
        $tanpaIzin->givePermissionTo(['santri.lihat', 'santri.tambah']);
        DB::table('user_lembaga')->insert([
            'user_id' => $tanpaIzin->id, 'lembaga_id' => $f['mi']->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->panggil($tanpaIzin, true)->assertStatus(403);
    }
}
