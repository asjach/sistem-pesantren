<?php

namespace Tests\Feature;

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
        $this->seed(ReferensiSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function baseFixture(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Tsanawiyah', 'kode' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $taMi = TahunAjaran::create([
            'lembaga_id' => $mi->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMd = TahunAjaran::create([
            'lembaga_id' => $md->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMts = TahunAjaran::create([
            'lembaga_id' => $mts->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $super = User::create([
            'name' => 'Super', 'email' => 'super-impor@example.com',
            'phone' => '081000000009', 'password' => 'password',
        ]);
        $super->assignRole('super_admin');

        return compact('root', 'mi', 'md', 'mts', 'taMi', 'taMd', 'taMts', 'super');
    }

    protected function panggil(User $u, array $body)
    {
        return $this->actingAs($u, 'sanctum')->postJson('/api/admin/kelas/import-nama', $body);
    }

    public function test_pratinjau_lalu_eksekusi_lewati_duplikat(): void
    {
        $f = $this->baseFixture();
        Kelas::create(['lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id, 'nama_kelas' => '1A', 'tingkat' => '1', 'urutan' => 1]);
        Kelas::create(['lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id, 'nama_kelas' => '1B', 'tingkat' => '1', 'urutan' => 2]);
        Kelas::create(['lembaga_id' => $f['md']->id, 'tahun_ajaran_id' => $f['taMd']->id, 'nama_kelas' => '1A', 'tingkat' => '1', 'urutan' => 1]);

        $body = [
            'lembaga_id' => $f['md']->id, 'tahun_ajaran_id' => $f['taMd']->id,
            'dari_kode' => 'MI', 'periksa' => true,
        ];
        $res = $this->panggil($f['super'], $body)->assertStatus(200);
        $this->assertSame(1, (int) $res->json('ringkasan.dibuat'));
        $this->assertSame(1, (int) $res->json('ringkasan.dilewati'));
        $this->assertSame(1, Kelas::where('lembaga_id', $f['md']->id)->count()); // pratinjau tak menulis

        $this->panggil($f['super'], array_merge($body, ['periksa' => false]))->assertStatus(200);
        $dibuat = Kelas::where('lembaga_id', $f['md']->id)->where('nama_kelas', '1B')->firstOrFail();
        $this->assertSame('1', $dibuat->tingkat);
    }

    public function test_bukan_pasangan_ditolak(): void
    {
        $f = $this->baseFixture();

        $this->panggil($f['super'], [
            'lembaga_id' => $f['mts']->id, 'tahun_ajaran_id' => $f['taMts']->id,
            'dari_kode' => 'MI', 'periksa' => true,
        ])->assertStatus(422);
    }

    public function test_target_luar_lingkup_ditolak(): void
    {
        $f = $this->baseFixture();
        $adminMi = User::create([
            'name' => 'Admin MI', 'email' => 'adminmi-impor@example.com',
            'phone' => '081000000010', 'password' => 'password',
        ]);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMi->id, 'lembaga_id' => $f['mi']->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->panggil($adminMi, [
            'lembaga_id' => $f['md']->id, 'tahun_ajaran_id' => $f['taMd']->id,
            'dari_kode' => 'MI', 'periksa' => true,
        ])->assertStatus(403);
    }
}
