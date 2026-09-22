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
            'nama' => 'Pesantren Root', 'jenjang' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);

        return compact('root', 'mi', 'md');
    }

    protected function makeAdmin(array $jenjangs): User
    {
        $u = User::create([
            'name' => 'Admin Samakan',
            'email' => 'samakan_'.uniqid().'@example.com',
            'phone' => '08'.str_pad((string) random_int(9000000000, 9299999999), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole('admin');
        foreach ($jenjangs as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function anggota(Santri $s, string $jenjang, ?string $nis): void
    {
        LembagaSantri::create([
            'santri_id' => $s->id, 'jenjang' => $jenjang,
            'nis_lokal' => $nis, 'is_active_lembaga' => 'Ya',
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
        $admin = $this->makeAdmin([$f['mi']->jenjang, $f['md']->jenjang]);

        $a = Santri::create(['nama_lengkap' => 'Ganda A', 'jk' => 'L']);
        $this->anggota($a, $f['mi']->jenjang, '27001');
        $this->anggota($a, $f['md']->jenjang, null);

        $b = Santri::create(['nama_lengkap' => 'Ganda B', 'jk' => 'P']);
        $this->anggota($b, $f['mi']->jenjang, null);
        $this->anggota($b, $f['md']->jenjang, '27002');

        $res = $this->panggil($admin, true)->assertStatus(200);
        $this->assertSame(2, (int) $res->json('ringkasan.disamakan'));
        // Pratinjau tidak menulis.
        $this->assertNull(LembagaSantri::where('santri_id', $a->id)->where('jenjang', $f['md']->jenjang)->firstOrFail()->nis_lokal);

        $this->panggil($admin, false)->assertStatus(200);
        $this->assertSame('27001', LembagaSantri::where('santri_id', $a->id)->where('jenjang', $f['md']->jenjang)->firstOrFail()->nis_lokal);
        $this->assertSame('27002', LembagaSantri::where('santri_id', $b->id)->where('jenjang', $f['mi']->jenjang)->firstOrFail()->nis_lokal);
    }

    public function test_beda_dua_sisi_dilaporkan_tanpa_disentuh(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang, $f['md']->jenjang]);

        $s = Santri::create(['nama_lengkap' => 'Beda', 'jk' => 'L']);
        $this->anggota($s, $f['mi']->jenjang, '27101');
        $this->anggota($s, $f['md']->jenjang, '27201');

        $res = $this->panggil($admin, false)->assertStatus(200);
        $this->assertSame(0, (int) $res->json('ringkasan.disamakan'));
        $this->assertSame(1, (int) $res->json('ringkasan.beda'));
        $this->assertSame('27101', LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['mi']->jenjang)->firstOrFail()->nis_lokal);
    }

    public function test_tabrakan_dilewati(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang, $f['md']->jenjang]);

        $pemilik = Santri::create(['nama_lengkap' => 'Pemilik', 'jk' => 'L']);
        $this->anggota($pemilik, $f['md']->jenjang, '27301');

        $s = Santri::create(['nama_lengkap' => 'Korban', 'jk' => 'L']);
        $this->anggota($s, $f['mi']->jenjang, '27301');
        $this->anggota($s, $f['md']->jenjang, null);

        $res = $this->panggil($admin, false)->assertStatus(200);
        $this->assertSame(1, (int) $res->json('ringkasan.tabrakan'));
        $this->assertNull(LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->firstOrFail()->nis_lokal);
    }

    public function test_luar_lingkup_dikecualikan_dan_tanpa_izin_ditolak(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeAdmin([$f['mi']->jenjang]);

        $s = Santri::create(['nama_lengkap' => 'Luar', 'jk' => 'L']);
        $this->anggota($s, $f['mi']->jenjang, '27401');
        $this->anggota($s, $f['md']->jenjang, null);

        // Admin MI bisa menulis MD (pengecualian pasangan) → kandidat disamakan.
        $res = $this->panggil($adminMi, false)->assertStatus(200);
        $this->assertSame(1, (int) $res->json('ringkasan.disamakan'));
        $this->assertSame('27401', LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['md']->jenjang)->firstOrFail()->nis_lokal);

        $tanpaIzin = User::create([
            'name' => 'Tanpa Izin', 'email' => 'tanpa_'.uniqid().'@example.com',
            'phone' => '089000000002', 'password' => 'password',
        ]);
        $tanpaIzin->givePermissionTo(['santri.lihat', 'santri.tambah']);
        DB::table('user_lembaga')->insert([
            'user_id' => $tanpaIzin->id, 'jenjang' => $f['mi']->jenjang,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->panggil($tanpaIzin, true)->assertStatus(403);
    }
}
