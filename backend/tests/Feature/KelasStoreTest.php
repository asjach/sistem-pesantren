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

// Store kelas: mode tunggal (kompatibel) + bulk via items (sub-form dialog).
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

        $this->seed(ReferensiSeeder::class);

        return compact('root', 'mi', 'taMi', 'super');
    }

    public function test_index_dengan_urut_dan_filter_tidak_ambigu(): void
    {
        $f = $this->baseFixture();
        Kelas::create([
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id,
            'nama_kelas' => 'I-A', 'tingkat' => '1',
        ]);

        // Join lembaga + tahun_ajaran (sort) + filter: kolom harus terkualifikasi.
        $this->actingAs($f['super'], 'sanctum')->getJson(
            '/api/admin/kelas?lembaga_id='.$f['mi']->id
            .'&tahun_ajaran_id='.$f['taMi']->id.'&sort=nama&arah=naik'
        )->assertStatus(200)->assertJsonPath('data.0.nama_kelas', 'I-A');
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

    public function test_05_admin_scoped_dan_root_ditolak(): void
    {
        $f = $this->baseFixture();
        $md = Lembaga::create([
            'parent_id' => Lembaga::where('kode', 'PESANTREN')->firstOrFail()->id,
            'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'parent_id' => Lembaga::where('kode', 'PESANTREN')->firstOrFail()->id,
            'nama' => 'Tsanawiyah', 'kode' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $taMd = TahunAjaran::create([
            'lembaga_id' => $md->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $adminMi = User::create([
            'name' => 'Admin MI', 'email' => 'admin-mi-kelas@example.com',
            'phone' => '081000000005', 'password' => 'password',
        ]);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMi->id, 'lembaga_id' => $f['mi']->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $payload = fn (?int $lembagaId) => [
            'lembaga_id' => $lembagaId,
            'tahun_ajaran_id' => $f['taMi']->id,
            'nama_kelas' => 'I-A',
        ];

        // Lembaganya sendiri → lolos.
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/kelas', $payload($f['mi']->id))
            ->assertStatus(201);

        // Pasangan MD → lolos (pengecualian timbal-balik).
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $md->id,
            'tahun_ajaran_id' => $taMd->id,
            'nama_kelas' => 'I-A',
        ])->assertStatus(201);

        // Non-pasangan (MTS) → 403; root → 422; tanpa tulisan baru selain dua baris.
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $mts->id,
            'tahun_ajaran_id' => $f['taMi']->id,
            'nama_kelas' => 'VII-A',
        ])->assertStatus(403);
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', $payload(
            Lembaga::where('kode', 'PESANTREN')->firstOrFail()->id
        ))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['lembaga_id']);
        $this->assertSame(2, Kelas::count());
    }

    public function test_06_daftar_urut_nama_ascending(): void
    {
        $f = $this->baseFixture();
        foreach (['2B', '1A', '1B'] as $nama) {
            Kelas::create([
                'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id, 'nama_kelas' => $nama,
            ]);
        }

        $res = $this->actingAs($f['super'], 'sanctum')
            ->getJson('/api/admin/kelas?lembaga_id='.$f['mi']->id)
            ->assertStatus(200);

        $this->assertSame(
            ['1A', '1B', '2B'],
            collect($res->json('data'))->pluck('nama_kelas')->all()
        );
    }

    // ---------- 07. duplikat: dalam satu payload, DB, & update ----------

    public function test_07_duplikat_dalam_satu_payload_ditolak(): void
    {
        $f = $this->baseFixture();

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
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
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
            'nama_kelas' => '1A',
            'tingkat' => '1',
        ])->assertStatus(201);

        // Nama duplikat (beda kapital + spasi berlebih) → 422, nama tersimpan tetap rapi.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
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
            'parent_id' => $f['root']->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $taMiBerikut = TahunAjaran::create([
            'lembaga_id' => $f['mi']->id, 'nama' => '2027/2028',
            'tanggal_mulai' => '2027-07-01', 'tanggal_selesai' => '2028-06-30', 'is_aktif' => false,
        ]);
        $taMd = TahunAjaran::create([
            'lembaga_id' => $md->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $payload = fn (int $lembagaId, int $taId) => [
            'lembaga_id' => $lembagaId, 'tahun_ajaran_id' => $taId, 'nama_kelas' => '1A',
        ];

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', $payload($f['mi']->id, $f['taMi']->id))->assertStatus(201);
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', $payload($f['mi']->id, $taMiBerikut->id))->assertStatus(201);
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', $payload($md->id, $taMd->id))->assertStatus(201);

        $this->assertSame(3, Kelas::count());
    }

    public function test_10_update_nama_duplikat_ditolak(): void
    {
        $f = $this->baseFixture();
        $kelasA = Kelas::create([
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id, 'nama_kelas' => '1A',
        ]);
        $kelasB = Kelas::create([
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id, 'nama_kelas' => '1B',
        ]);

        // Ubah B → nama A (beda kapital) → 422, nama lama tidak berubah.
        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$kelasB->id}", ['nama_kelas' => '1a'])
            ->assertStatus(422);
        $this->assertSame('1B', $kelasB->fresh()->nama_kelas);

        // Nama sendiri + kapasitas → tetap boleh (dikecualikan dari cek duplikat).
        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$kelasB->id}", ['nama_kelas' => '1B', 'kapasitas' => 28])
            ->assertStatus(200);
        $this->assertSame(28, (int) $kelasB->fresh()->kapasitas);

        // Nama kosong saat diisi → 422.
        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$kelasA->id}", ['nama_kelas' => '   '])
            ->assertStatus(422);
    }

    public function test_11_urutan_disimpan_dan_mengurutkan_daftar(): void
    {
        $f = $this->baseFixture();

        // Bulk: urutan ikut tersimpan (default 0 bila kosong).
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
            'items' => [
                ['nama_kelas' => '1C', 'urutan' => 3],
                ['nama_kelas' => '1A', 'urutan' => 1],
                ['nama_kelas' => '1B'],
            ],
        ])->assertStatus(201);

        $this->assertSame(3, (int) Kelas::where('nama_kelas', '1C')->value('urutan'));
        $this->assertSame(0, (int) Kelas::where('nama_kelas', '1B')->value('urutan'));

        // Daftar diurutkan `urutan` dulu, lalu nama kelas.
        $res = $this->actingAs($f['super'], 'sanctum')
            ->getJson('/api/admin/kelas?lembaga_id='.$f['mi']->id.'&tahun_ajaran_id='.$f['taMi']->id)
            ->assertStatus(200);
        $this->assertSame(['1B', '1A', '1C'], array_column($res->json('data'), 'nama_kelas'));

        // Update urutan lewat grid (PUT).
        $idA = (int) Kelas::where('nama_kelas', '1A')->value('id');
        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$idA}", ['urutan' => 9])
            ->assertStatus(200);
        $this->assertSame(9, (int) Kelas::find($idA)->urutan);

        // Urutan negatif ditolak.
        $this->actingAs($f['super'], 'sanctum')->putJson("/api/admin/kelas/{$idA}", ['urutan' => -1])
            ->assertStatus(422)->assertJsonValidationErrors(['urutan']);
    }
}
