<?php

namespace Tests\Feature;

use App\Exports\KelasNamaExport;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\ReferensiSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Import nama kelas pasangan MI↔MD: pratinjau + eksekusi, lewati duplikat.
class KelasImportNamaTest extends TestCase
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
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        // TA global (berlaku semua lembaga) — satu baris untuk semua.
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMi = $taMd = $taMts = $ta;
        $super = User::create([
            'name' => 'Super', 'email' => 'super-impor@example.com',
            'phone' => '081000000009', 'password' => 'password',
        ]);
        $super->assignRole('super_admin');

        $this->seed(ReferensiSeeder::class);

        return compact('root', 'mi', 'md', 'mts', 'taMi', 'taMd', 'taMts', 'super');
    }

    protected function panggil(User $u, array $body)
    {
        return $this->actingAs($u, 'sanctum')->postJson('/api/admin/kelas/import-nama', $body);
    }

    public function test_pratinjau_lalu_eksekusi_lewati_duplikat(): void
    {
        $f = $this->baseFixture();
        Kelas::create(['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama, 'nama_kelas' => '1A', 'tingkat' => '1', 'urutan' => 1]);
        Kelas::create(['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama, 'nama_kelas' => '1B', 'tingkat' => '1', 'urutan' => 2]);
        Kelas::create(['jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '1A', 'tingkat' => '1', 'urutan' => 1]);

        $body = [
            'jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama,
            'dari_kode' => 'MI', 'periksa' => true,
        ];
        $res = $this->panggil($f['super'], $body)->assertStatus(200);
        $this->assertSame(1, (int) $res->json('ringkasan.dibuat'));
        $this->assertSame(1, (int) $res->json('ringkasan.dilewati'));
        $this->assertSame(1, Kelas::where('jenjang', $f['md']->jenjang)->count()); // pratinjau tak menulis

        $this->panggil($f['super'], array_merge($body, ['periksa' => false]))->assertStatus(200);
        $dibuat = Kelas::where('jenjang', $f['md']->jenjang)->where('nama_kelas', '1B')->firstOrFail();
        $this->assertSame('1', $dibuat->tingkat);
    }

    public function test_mode_copy_ke_kode_target_otomatis(): void
    {
        $f = $this->baseFixture();
        Kelas::create(['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama, 'nama_kelas' => '2A', 'tingkat' => '2', 'urutan' => 1]);

        // Copy MI → MD: target + TA diselesaikan server.
        $res = $this->panggil($f['super'], [
            'dari_jenjang' => $f['mi']->jenjang, 'dari_tahun_ajaran' => $f['taMi']->nama,
            'ke_kode' => 'MD', 'periksa' => true,
        ])->assertStatus(200);
        $this->assertSame('MD', $res->json('tujuan.kode'));
        $this->assertSame('2026/2027', $res->json('tujuan.tahun_ajaran'));
        $this->assertSame(1, (int) $res->json('ringkasan.dibuat'));

        $this->panggil($f['super'], [
            'dari_jenjang' => $f['mi']->jenjang, 'dari_tahun_ajaran' => $f['taMi']->nama,
            'ke_kode' => 'MD', 'periksa' => false,
        ])->assertStatus(200);
        $this->assertDatabaseHas('kelas', [
            'jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '2A',
        ]);
    }

    public function test_bukan_pasangan_ditolak(): void
    {
        $f = $this->baseFixture();

        $this->panggil($f['super'], [
            'jenjang' => $f['mts']->jenjang, 'tahun_ajaran' => $f['taMts']->nama,
            'dari_kode' => 'MI', 'periksa' => true,
        ])->assertStatus(422);
    }

    public function test_admin_satu_lembaga_bisa_baca_pasangan(): void
    {
        $f = $this->baseFixture();
        Kelas::create(['jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama, 'nama_kelas' => '1A', 'tingkat' => '1', 'urutan' => 1]);

        $adminMi = User::create([
            'name' => 'Admin MI', 'email' => 'adminmi-baca@example.com',
            'phone' => '081000000011', 'password' => 'password',
        ]);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMi->id, 'jenjang' => $f['mi']->jenjang,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        // Target MI miliknya, sumber MD terbaca via pengecualian pasangan.
        $this->panggil($adminMi, [
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama,
            'dari_kode' => 'MD', 'periksa' => false,
        ])->assertStatus(200);
        $this->assertDatabaseHas('kelas', ['jenjang' => $f['mi']->jenjang, 'nama_kelas' => '1A']);
    }

    public function test_export_nama_kelas(): void
    {
        $f = $this->baseFixture();
        Kelas::create(['jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama, 'nama_kelas' => '1A', 'tingkat' => '1', 'urutan' => 1]);

        $this->actingAs($f['super'], 'sanctum')
            ->get("/api/admin/kelas/export-nama?jenjang={$f['mi']->jenjang}&tahun_ajaran={$f['taMi']->nama}")
            ->assertStatus(200)
            ->assertHeader('content-disposition', 'attachment; filename=daftar-kelas-MI-20262027.xlsx');

        $isi = (new KelasNamaExport($f['mi']->jenjang, $f['taMi']->nama))->array();
        $this->assertSame([['1A', '1', '1']], $isi);

        $adminMi = User::create([
            'name' => 'Admin MI', 'email' => 'adminmi-ekspor@example.com',
            'phone' => '081000000012', 'password' => 'password',
        ]);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMi->id, 'jenjang' => $f['mi']->jenjang,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($adminMi, 'sanctum')
            ->get("/api/admin/kelas/export-nama?jenjang={$f['md']->jenjang}&tahun_ajaran={$f['taMd']->nama}")
            ->assertStatus(200);

        // Non-pasangan (MTS) tetap ditolak.
        $adminMts = User::create([
            'name' => 'Admin MTS', 'email' => 'adminmts-ekspor@example.com',
            'phone' => '081000000013', 'password' => 'password',
        ]);
        $adminMts->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMts->id, 'jenjang' => $f['mts']->jenjang,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->actingAs($adminMts, 'sanctum')
            ->get("/api/admin/kelas/export-nama?jenjang={$f['md']->jenjang}&tahun_ajaran={$f['taMd']->nama}")
            ->assertStatus(403);
    }

    public function test_target_luar_lingkup_ditolak(): void
    {
        $f = $this->baseFixture();
        $adminMts = User::create([
            'name' => 'Admin MTS', 'email' => 'adminmts-impor@example.com',
            'phone' => '081000000014', 'password' => 'password',
        ]);
        $adminMts->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMts->id, 'jenjang' => $f['mts']->jenjang,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->panggil($adminMts, [
            'jenjang' => $f['md']->jenjang, 'tahun_ajaran' => $f['taMd']->nama,
            'dari_kode' => 'MI', 'periksa' => true,
        ])->assertStatus(403);
    }
}
