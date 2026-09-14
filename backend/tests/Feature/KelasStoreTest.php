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
use Tests\TestCase;

// Store kelas: mode tunggal (kompatibel) + bulk via items (sub-form dialog).
class KelasStoreTest extends TestCase
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
        $taMi = TahunAjaran::create([
            'lembaga_id' => $mi->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $super = User::create([
            'name' => 'Super', 'email' => 'super-kelas@example.com',
            'phone' => '081000000004', 'password' => 'password',
        ]);
        $super->assignRole('super_admin');

        return compact('root', 'mi', 'taMi', 'super');
    }

    public function test_01_tunggal_kompatibel(): void
    {
        $f = $this->baseFixture();

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
            'nama_kelas' => 'I-A',
            'tingkat' => '1',
            'kapasitas' => 30,
        ])->assertStatus(201);

        $this->assertEquals('I-A', $res->json('nama_kelas'));
        $this->assertDatabaseHas('kelas', ['lembaga_id' => $f['mi']->id, 'nama_kelas' => 'I-A']);
    }

    public function test_02_bulk_items_berhasil_semua(): void
    {
        $f = $this->baseFixture();

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
            'items' => [
                ['nama_kelas' => '1A', 'tingkat' => '1'],
                ['nama_kelas' => '1B', 'tingkat' => '1', 'kapasitas' => 28],
                ['nama_kelas' => '2A'],
            ],
        ])->assertStatus(201);

        $this->assertCount(3, $res->json('data'));
        $this->assertSame(3, Kelas::where('lembaga_id', $f['mi']->id)->count());
        $this->assertDatabaseHas('kelas', ['nama_kelas' => '1B', 'kapasitas' => 28]);
        $this->assertNull(Kelas::where('nama_kelas', '2A')->firstOrFail()->tingkat);
    }

    public function test_03_bulk_gagal_satu_batal_semua(): void
    {
        $f = $this->baseFixture();

        // Baris tanpa nama → 422 validasi, tanpa tulisan.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
            'items' => [
                ['nama_kelas' => '1A', 'tingkat' => '1'],
                ['tingkat' => '1'],
            ],
        ])->assertStatus(422);
        $this->assertSame(0, Kelas::count());

        // Tingkat tak dikenal → 422, tanpa tulisan (rollback transaksi).
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
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
        $taRoot = TahunAjaran::create([
            'lembaga_id' => $f['root']->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $taRoot->id,
            'nama_kelas' => 'I-A',
        ])->assertStatus(422);
        $this->assertSame(0, Kelas::count());

        // Mode tunggal tanpa nama_kelas → 422.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
        ])->assertStatus(422);
    }
}
