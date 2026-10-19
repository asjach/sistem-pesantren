<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaTahunAjaran;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\ReferensiSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class KelasStoreTest extends TestCase
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
        $taMi = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $super = User::create([
            'name' => 'Super', 'email' => 'super-kelas@example.com',
            'phone' => '081000000004', 'password' => 'password',
        ]);
        $super->assignRole('super_admin');

        $this->seed(ReferensiSeeder::class);

        return compact('root', 'mi', 'taMi', 'super');
    }

    public function test_index_dengan_urut_dan_filter_tidak_ambigu(): void
    {
        $f = $this->baseFixture();
        Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama,
            'nama_kelas' => 'I-A', 'tingkat' => '1',
        ]);

        $this->actingAs($f['super'], 'sanctum')->getJson(
            '/api/admin/kelas?jenjang='.$f['mi']->jenjang
            .'&tahun_ajaran='.$f['taMi']->nama.'&sort=nama&arah=naik'
        )->assertStatus(200)->assertJsonPath('data.0.nama_kelas', 'I-A');
    }

    public function test_01_tunggal_kompatibel(): void
    {
        $f = $this->baseFixture();

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'nama_kelas' => 'I-A',
            'tingkat' => '1',
            'kapasitas' => 30,
        ])->assertStatus(201);

        $this->assertEquals('I-A', $res->json('nama_kelas'));
        $this->assertDatabaseHas('kelas', ['jenjang' => $f['mi']->jenjang, 'nama_kelas' => 'I-A']);
    }

    public function test_02_bulk_items_berhasil_semua(): void
    {
        $f = $this->baseFixture();

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'items' => [
                ['nama_kelas' => '1A', 'tingkat' => '1'],
                ['nama_kelas' => '1B', 'nama_alias' => 'Umar', 'tingkat' => '1', 'kapasitas' => 28],
                ['nama_kelas' => '2A'],
            ],
        ])->assertStatus(201);

        $this->assertCount(3, $res->json('data'));
        $this->assertSame(3, Kelas::where('jenjang', $f['mi']->jenjang)->count());
        $this->assertDatabaseHas('kelas', ['nama_kelas' => '1B', 'nama_alias' => 'Umar', 'kapasitas' => 28]);
        $this->assertNull(Kelas::where('nama_kelas', '1A')->firstOrFail()->nama_alias);
        $this->assertNull(Kelas::where('nama_kelas', '2A')->firstOrFail()->tingkat);
    }

    public function test_03_bulk_gagal_satu_batal_semua(): void
    {
        $f = $this->baseFixture();

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'items' => [
                ['nama_kelas' => '1A', 'tingkat' => '1'],
                ['tingkat' => '1'],
            ],
        ])->assertStatus(422);
        $this->assertSame(0, Kelas::count());

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'items' => [
                ['nama_kelas' => '1A', 'tingkat' => '1'],
                ['nama_kelas' => '1B', 'tingkat' => 'TIDAK_ADA'],
            ],
        ])->assertStatus(422);
        $this->assertSame(0, Kelas::count());
    }

    public function test_04_ta_silang_dan_tanpa_items_nama_wajib(): void
    {
        $f = $this->baseFixture();

        LembagaTahunAjaran::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama, 'is_active' => false,
        ]);

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'nama_kelas' => 'I-A',
        ])->assertStatus(422);
        $this->assertSame(0, Kelas::count());

        LembagaTahunAjaran::where('jenjang', $f['mi']->jenjang)->delete();
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
        ])->assertStatus(422);
    }

    public function test_05_admin_scoped_dan_root_ditolak(): void
    {
        $f = $this->baseFixture();
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $taMd = TahunAjaran::create([
            'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => false,
        ]);
        $adminMi = User::create([
            'name' => 'Admin MI', 'email' => 'admin-mi-kelas@example.com',
            'phone' => '081000000005', 'password' => 'password',
        ]);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMi->id, 'jenjang' => $f['mi']->jenjang,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $payload = fn (?string $jenjang) => [
            'jenjang' => $jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'nama_kelas' => 'I-A',
        ];

        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/kelas', $payload($f['mi']->jenjang))
            ->assertStatus(201);

        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $md->jenjang,
            'tahun_ajaran' => $taMd->nama,
            'nama_kelas' => 'I-A',
        ])->assertStatus(201);

        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $mts->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'nama_kelas' => 'VII-A',
        ])->assertStatus(403);
        $this->assertSame(2, Kelas::count());
    }

    public function test_06_daftar_urut_nama_ascending(): void
    {
        $f = $this->baseFixture();
        foreach (['2B', '1A', '1B'] as $nama) {
            Kelas::create([
                'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama, 'nama_kelas' => $nama,
            ]);
        }

        $res = $this->actingAs($f['super'], 'sanctum')
            ->getJson('/api/admin/kelas?jenjang='.$f['mi']->jenjang)
            ->assertStatus(200);

        $this->assertSame(
            ['1A', '1B', '2B'],
            collect($res->json('data'))->pluck('nama_kelas')->all()
        );
    }

    public function test_07_duplikat_dalam_satu_payload_ditolak(): void
    {
        $f = $this->baseFixture();

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'items' => [
                ['nama_kelas' => '1A', 'tingkat' => '1'],
                ['nama_kelas' => ' 1a ', 'tingkat' => '1'],
            ],
        ])->assertStatus(422);

        $this->assertSame(0, Kelas::count());
    }

    public function test_08_duplikat_beda_huruf_besar_kecil_ditolak(): void
    {
        $f = $this->baseFixture();

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'nama_kelas' => '1A',
            'tingkat' => '1',
        ])->assertStatus(201);

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'nama_kelas' => '  1a  ',
            'tingkat' => '1',
        ])->assertStatus(422);

        $this->assertSame(1, Kelas::count());
        $this->assertSame('1A', Kelas::firstOrFail()->nama_kelas);
    }

    public function test_09_nama_sama_di_ta_atau_lembaga_berbeda_diizinkan(): void
    {
        $f = $this->baseFixture();
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $taMiBerikut = TahunAjaran::create([
            'nama' => '2027/2028',
            'tanggal_mulai' => '2027-07-01', 'tanggal_selesai' => '2028-06-30', 'is_aktif' => false,
        ]);
        $taMd = TahunAjaran::create([
            'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => false,
        ]);
        $payload = fn (string $jenjang, string $ta) => [
            'jenjang' => $jenjang, 'tahun_ajaran' => $ta, 'nama_kelas' => '1A',
        ];

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', $payload($f['mi']->jenjang, $f['taMi']->nama))->assertStatus(201);
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', $payload($f['mi']->jenjang, $taMiBerikut->nama))->assertStatus(201);
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', $payload($md->jenjang, $taMd->nama))->assertStatus(201);

        $this->assertSame(3, Kelas::count());
    }

    public function test_10_update_nama_duplikat_ditolak(): void
    {
        $f = $this->baseFixture();
        $kelasA = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama, 'nama_kelas' => '1A',
        ]);
        $kelasB = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama, 'nama_kelas' => '1B',
        ]);

        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$kelasB->id}", ['nama_kelas' => '1a'])
            ->assertStatus(422);
        $this->assertSame('1B', $kelasB->fresh()->nama_kelas);

        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$kelasB->id}", ['nama_kelas' => '1B', 'kapasitas' => 28])
            ->assertStatus(200);
        $this->assertSame(28, (int) $kelasB->fresh()->kapasitas);

        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$kelasA->id}", ['nama_kelas' => '   '])
            ->assertStatus(422);
    }

    public function test_11_urutan_disimpan_dan_mengurutkan_daftar(): void
    {
        $f = $this->baseFixture();

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'items' => [
                ['nama_kelas' => '1C', 'urutan' => 3],
                ['nama_kelas' => '1A', 'urutan' => 1],
                ['nama_kelas' => '1B'],
            ],
        ])->assertStatus(201);

        $this->assertSame(3, (int) Kelas::where('nama_kelas', '1C')->value('urutan'));
        $this->assertSame(0, (int) Kelas::where('nama_kelas', '1B')->value('urutan'));

        $res = $this->actingAs($f['super'], 'sanctum')
            ->getJson('/api/admin/kelas?jenjang='.$f['mi']->jenjang.'&tahun_ajaran='.$f['taMi']->nama)
            ->assertStatus(200);
        $this->assertSame(['1B', '1A', '1C'], array_column($res->json('data'), 'nama_kelas'));

        $idA = (int) Kelas::where('nama_kelas', '1A')->value('id');
        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$idA}", ['urutan' => 9])
            ->assertStatus(200);
        $this->assertSame(9, (int) Kelas::find($idA)->urutan);

        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$idA}", ['urutan' => -1])
            ->assertStatus(422)->assertJsonValidationErrors(['urutan']);
    }
}
