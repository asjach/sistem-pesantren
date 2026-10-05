<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\PengaturanTabel;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Visibilitas filter topBar global per table_key: baca bebas semua admin,
 * tulis khusus super_admin, kunci filter tak dikenal dan nilai
 * non-boolean ditolak, dan mode dibaca per tabel lewat batch.
 */
class PengaturanTabelTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->seq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->seq,
            'email' => "tabel_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0815'.str_pad((string) (40000000 + $this->seq), 8, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    public function test_baca_bebas_tulis_super_admin_saja(): void
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $pusat = $this->makeUser('super_admin');
        $scoped = $this->makeUser('admin', [$mi->jenjang]);

        // Belum ada baris: filter kosong (ikut bawaan kode).
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/pengaturan-tabel?keys[]=daftar_kelas')
            ->assertStatus(200)
            ->assertJsonPath('data.daftar_kelas.filter', []);

        // Admin lembaga ditolak menulis (403), baris tak terbentuk.
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
            'filter' => ['tingkat' => false],
        ])->assertStatus(403);
        $this->assertSame(0, PengaturanTabel::where('table_key', 'daftar_kelas')->count());

        // Super_admin menyimpan + membaca kembali (per kunci: MySQL tak
        // menjamin urutan kunci objek JSON sama dengan urutan kirim).
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
            'filter' => ['tingkat' => false, 'kelas' => true, 'semester' => false],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/pengaturan-tabel?keys[]=daftar_kelas')
            ->assertStatus(200)
            ->assertJsonPath('data.daftar_kelas.filter.tingkat', false)
            ->assertJsonPath('data.daftar_kelas.filter.kelas', true)
            ->assertJsonPath('data.daftar_kelas.filter.semester', false);

        // Simpan parsial tak menghapus kunci lain.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
            'filter' => ['lembaga' => false],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/pengaturan-tabel?keys[]=daftar_kelas')
            ->assertStatus(200)
            ->assertJsonPath('data.daftar_kelas.filter.tingkat', false)
            ->assertJsonPath('data.daftar_kelas.filter.kelas', true)
            ->assertJsonPath('data.daftar_kelas.filter.semester', false)
            ->assertJsonPath('data.daftar_kelas.filter.lembaga', false);

        // Admin lembaga ditolak menghapus; super_admin mengembalikan bawaan.
        $this->actingAs($scoped, 'sanctum')
            ->deleteJson('/api/admin/pengaturan-tabel?table_key=daftar_kelas')
            ->assertStatus(403);
        $this->actingAs($pusat, 'sanctum')
            ->deleteJson('/api/admin/pengaturan-tabel?table_key=daftar_kelas')
            ->assertStatus(200);
        $this->assertSame(0, PengaturanTabel::where('table_key', 'daftar_kelas')->count());
    }

    public function test_batch_mengembalikan_peta_per_tabel(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'psb',
            'filter' => ['lembaga' => true],
        ])->assertStatus(200);

        $res = $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/pengaturan-tabel?keys[]=psb&keys[]=keuangan_tagihan')
            ->assertStatus(200)
            ->json();

        $this->assertSame(true, $res['data']['psb']['filter']['lembaga']);
        $this->assertSame([], $res['data']['keuangan_tagihan']['filter']);
        $this->assertSame('single', $res['data']['keuangan_tagihan']['filter_mode']['lembaga']);
    }

    public function test_mode_filter_bawaan_saat_data_kosong(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/pengaturan-tabel?keys[]=daftar_kelas')
            ->assertStatus(200)
            ->assertJsonPath('data.daftar_kelas.filter_mode', [
                'lembaga' => 'single',
                'tahun_ajaran' => 'single',
                'semester' => 'single',
                'tingkat' => 'single',
                'kelas' => 'single',
            ]);
    }

    public function test_mode_filter_disimpan_dan_bergabung(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
            'filter_mode' => ['lembaga' => 'multiple'],
        ])->assertStatus(200)
            ->assertJsonPath('data.filter', [])
            ->assertJsonPath('data.filter_mode', [
                'lembaga' => 'multiple',
                'tahun_ajaran' => 'single',
                'semester' => 'single',
                'tingkat' => 'single',
                'kelas' => 'single',
            ]);

        $row = PengaturanTabel::where('table_key', 'daftar_kelas')->firstOrFail();
        $this->assertSame([], $row->filter);
        $this->assertSame('multiple', $row->filter_mode['lembaga']);
        $this->assertSame('single', $row->filter_mode['tahun_ajaran']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
            'filter_mode' => ['tahun_ajaran' => 'multiple'],
        ])->assertStatus(200);

        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/pengaturan-tabel?keys[]=daftar_kelas')
            ->assertStatus(200)
            ->assertJsonPath('data.daftar_kelas.filter_mode.lembaga', 'multiple')
            ->assertJsonPath('data.daftar_kelas.filter_mode.tahun_ajaran', 'multiple')
            ->assertJsonPath('data.daftar_kelas.filter_mode.semester', 'single')
            ->assertJsonPath('data.daftar_kelas.filter_mode.tingkat', 'single')
            ->assertJsonPath('data.daftar_kelas.filter_mode.kelas', 'single');
    }

    public function test_validasi_kunci_dan_nilai(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
            'filter' => ['tingkat' => 'ya'],
        ])->assertStatus(422)->assertJsonValidationErrors(['filter.tingkat']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
            'filter' => ['filter_asing' => true],
        ])->assertStatus(422)->assertJsonValidationErrors(['filter']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
            'filter_mode' => ['filter_asing' => 'single'],
        ])->assertStatus(422)->assertJsonValidationErrors(['filter_mode']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
            'filter_mode' => ['lembaga' => 'tidak_valid'],
        ])->assertStatus(422)->assertJsonValidationErrors(['filter_mode.lembaga']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/pengaturan-tabel', [
            'table_key' => 'daftar_kelas',
        ])->assertStatus(422)->assertJsonValidationErrors(['table_key']);

        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/pengaturan-tabel')
            ->assertStatus(422)->assertJsonValidationErrors(['keys']);
    }
}
