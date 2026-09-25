<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Import pengguna bertahap (potongan JSON 1000 baris): tenant (jenjangs) dan
// peran yang boleh ditetapkan dihitung dari akun yang menulis, bukan dari
// baris; periksa kering tanpa menulis; eksekusi menulis per potongan;
// identifier duplikat dalam sesi dilewati; galat CSV bisa diunduh.
class ImportPotongPenggunaTest extends TestCase
{
    use RefreshDatabase;

    protected int $userSeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
        // Id sesi mulai dari 1 di tiap tes → berkas galat lama tak boleh bocor.
        foreach (glob(storage_path('app/imports/galat-*.csv')) ?: [] as $berkas) {
            @unlink($berkas);
        }
    }

    protected function baseFixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $super = $this->makeUser('super_admin', []);
        $admin = $this->makeUser('admin', [$mi->jenjang]);

        return compact('mi', 'super', 'admin');
    }

    protected function makeUser(string $role, array $jenjangs): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Pengguna '.$this->userSeq,
            'email' => "pengguna_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9900000000 + $this->userSeq * 101), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($jenjangs as $j) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $j,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function baris(string $nama, string $email, array $tambah = []): array
    {
        return array_merge([
            'name' => $nama, 'email' => $email, 'password' => 'rahasia123',
            'roles' => 'guru',
        ], $tambah);
    }

    public function test_01_periksa_kering_tidak_menulis(): void
    {
        $f = $this->baseFixture();
        $sebelum = User::count();

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/users/import-potong', [
            'jenjangs' => [$f['mi']->jenjang],
            'mode' => 'periksa',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->baris('Guru Satu', 'guru1@example.com'),
                $this->baris('Guru Dua', 'bukan-email'),
            ],
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame('email', $res->json('galat_contoh.0.kolom'));
        $this->assertSame($sebelum, User::count());
        $this->assertSame(0, User::where('email', 'guru1@example.com')->count());
    }

    public function test_02_eksekusi_menulis_peran_dan_tenant_dari_akun(): void
    {
        $f = $this->baseFixture();

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/users/import-potong', [
            'jenjangs' => [$f['mi']->jenjang],
            'mode' => 'eksekusi',
            'total' => 3,
            'baris' => [$this->baris('Guru Tiga', 'guru3@example.com', ['roles' => 'guru, orang_tua'])],
        ])->assertStatus(200);
        $this->assertFalse((bool) $satu->json('selesai'));

        $baru = User::where('email', 'guru3@example.com')->firstOrFail();
        // Peran di-interseksikan dengan yang boleh ditetapkan akun.
        $this->assertSame(['guru', 'orang_tua'], $baru->getRoleNames()->sort()->values()->all());
        // Pivot tenant mengikuti `jenjangs`, bukan kolom file.
        $this->assertSame([$f['mi']->jenjang], DB::table('user_lembaga')->where('user_id', $baru->id)->pluck('jenjang')->all());

        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/users/import-potong', [
            'jenjangs' => [$f['mi']->jenjang],
            'sesi_id' => $satu->json('sesi_id'),
            'mode' => 'eksekusi',
            'terakhir' => true,
            'baris' => [$this->baris('Guru Empat', 'guru4@example.com')],
        ])->assertStatus(200);

        $this->assertSame(2, $dua->json('offset'));
        $this->assertTrue((bool) $dua->json('selesai'));
        $this->assertSame(2, $dua->json('ringkasan.dibuat'));
    }

    public function test_03_peran_di_luar_kewenangan_diabaikan(): void
    {
        $f = $this->baseFixture();

        // Admin (bukan super) tak boleh menetapkan super_admin/admin.
        $res = $this->actingAs($f['admin'], 'sanctum')->postJson('/api/admin/users/import-potong', [
            'jenjangs' => [$f['mi']->jenjang],
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$this->baris('Guru Lima', 'guru5@example.com', ['roles' => 'super_admin,admin'])],
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $baru = User::where('email', 'guru5@example.com')->firstOrFail();
        $this->assertSame([], $baru->getRoleNames()->all());
    }

    public function test_04_admin_non_global_tanpa_jenjangs_ditolak(): void
    {
        $f = $this->baseFixture();

        $this->actingAs($f['admin'], 'sanctum')->postJson('/api/admin/users/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$this->baris('Guru Enam', 'guru6@example.com')],
        ])->assertStatus(422);

        // Jenjang di luar kewenangan juga ditolak.
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => true, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $this->actingAs($f['admin'], 'sanctum')->postJson('/api/admin/users/import-potong', [
            'jenjangs' => [$mts->jenjang],
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$this->baris('Guru Tujuh', 'guru7@example.com')],
        ])->assertStatus(403);
    }

    public function test_05_duplikat_dalam_sesi_dilewati_dan_batas_1000(): void
    {
        $f = $this->baseFixture();

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/users/import-potong', [
            'jenjangs' => [$f['mi']->jenjang],
            'mode' => 'eksekusi',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->baris('Guru Delapan', 'guru8@example.com'),
                $this->baris('Guru Delapan Ganda', 'guru8@example.com'),
            ],
        ])->assertStatus(200);

        // Baris kedua bentrok unique → galat per baris (bukan ditimpa).
        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame('email', $res->json('galat_contoh.0.kolom'));
        $this->assertSame(1, User::where('email', 'guru8@example.com')->count());
        $this->assertSame('Guru Delapan', User::where('email', 'guru8@example.com')->value('name'));

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/users/import-potong', [
            'jenjangs' => [$f['mi']->jenjang],
            'mode' => 'periksa',
            'total' => 1001,
            'baris' => array_fill(0, 1001, $this->baris('Banjiri', 'banjiri@example.com')),
        ])->assertStatus(422);
    }

    public function test_06_sesi_milik_pengguna_lain_ditolak_dan_galat_bisa_diunduh(): void
    {
        $f = $this->baseFixture();
        $lain = $this->makeUser('super_admin', []);

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/users/import-potong', [
            'jenjangs' => [$f['mi']->jenjang],
            'mode' => 'eksekusi',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->baris('Guru Sembilan', 'guru9@example.com'),
                $this->baris('Tanpa Email', 'x', ['email' => '', 'phone' => '', 'username' => '']),
            ],
        ])->assertStatus(200);
        $sesiId = $satu->json('sesi_id');
        $this->assertSame(1, $satu->json('ringkasan.dibuat'));
        $this->assertSame(1, $satu->json('ringkasan.baris_gagal'));
        $this->assertTrue((bool) $satu->json('galat_unduh'));

        $galat = $this->actingAs($f['super'], 'sanctum')->get("/api/admin/users/import-potong/{$sesiId}/galat");
        $galat->assertStatus(200);
        $this->assertStringContainsString('Isi email, phone, atau username', $galat->streamedContent() ?: '');

        $this->actingAs($lain, 'sanctum')->get("/api/admin/users/import-potong/{$sesiId}/galat")->assertStatus(404);
        $this->actingAs($lain, 'sanctum')->post("/api/admin/users/import-potong/{$sesiId}/batal")->assertStatus(404);
        $this->actingAs($f['super'], 'sanctum')->post("/api/admin/users/import-potong/{$sesiId}/batal")->assertStatus(200);
        $this->actingAs($f['super'], 'sanctum')->get("/api/admin/users/import-potong/{$sesiId}/galat")->assertStatus(404);
    }
}
