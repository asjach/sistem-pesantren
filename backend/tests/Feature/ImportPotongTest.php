<?php

namespace Tests\Feature;

use App\Models\ImportSesi;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Import bertahap potongan JSON: sesi + offset + akumulator, periksa kering
// tanpa menulis, eksekusi menulis per potongan, galat CSV bisa diunduh.
class ImportPotongTest extends TestCase
{
    use RefreshDatabase;

    protected int $userSeq = 0;

    protected int $santriSeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function baseFixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $kelas = Kelas::create([
            'jenjang' => $mi->jenjang, 'tahun_ajaran' => $ta->nama, 'nama_kelas' => '1A', 'tingkat' => '1',
        ]);
        $super = $this->makeUser('super_admin', []);

        return compact('mi', 'ta', 'kelas', 'super');
    }

    protected function makeUser(string $role, array $jenjangs): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Potong '.$this->userSeq,
            'email' => "potong_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9500000000 + $this->userSeq * 53), 10, '0', STR_PAD_LEFT),
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

    protected function makeSantri(string $nama, string $nis, Lembaga $lembaga): Santri
    {
        $this->santriSeq++;
        $santri = Santri::create(['nama_lengkap' => $nama.' '.$this->santriSeq, 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => $lembaga->jenjang,
            'nis_lokal' => $nis, 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);

        return $santri;
    }

    protected function baris(string $nis, string $jenjang, string $ta, array $tambah = []): array
    {
        return array_merge([
            'nis_lokal' => $nis, 'jenjang' => $jenjang, 'tahun_ajaran' => $ta,
            'nama_kelas' => '1A', 'semester' => '1',
        ], $tambah);
    }

    public function test_01_periksa_kering_tanpa_menulis(): void
    {
        $f = $this->baseFixture();
        $a = $this->makeSantri('Potong A', '27001', $f['mi']);

        // Potongan 1 (2 baris: 1 valid + 1 santri tak dikenal).
        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'mode' => 'periksa',
            'total' => 3,
            'baris' => [
                $this->baris('27001', 'MI', '2026/2027'),
                $this->baris('27999', 'MI', '2026/2027'),
            ],
        ])->assertStatus(200);

        $sesiId = $satu->json('sesi_id');
        $this->assertSame(2, $satu->json('offset'));
        $this->assertFalse((bool) $satu->json('selesai'));
        $this->assertSame(1, $satu->json('ringkasan.dibuat'));
        $this->assertSame(1, $satu->json('ringkasan.baris_gagal'));
        // Kering: tidak ada yang tertulis.
        $this->assertSame(0, RiwayatBelajar::count());

        // Potongan 2 (terakhir): nomor galat absolut berlanjut.
        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'sesi_id' => $sesiId,
            'mode' => 'periksa',
            'terakhir' => true,
            'baris' => [$this->baris('27998', 'MI', '2026/2027')],
        ])->assertStatus(200);

        $this->assertTrue((bool) $dua->json('selesai'));
        $this->assertSame(3, $dua->json('offset'));
        $this->assertSame(2, $dua->json('ringkasan.baris_gagal'));
        $this->assertSame(0, RiwayatBelajar::count());
        $this->assertSame(ImportSesi::SELESAI, ImportSesi::find($sesiId)->status);

        // Galat bisa diunduh pemilik sesi.
        $galat = $this->actingAs($f['super'], 'sanctum')->get("/api/admin/riwayat-belajar/import-potong/{$sesiId}/galat");
        $galat->assertStatus(200);
        $this->assertStringContainsString('27999', $galat->streamedContent() ?: '');
        $this->assertStringContainsString('27998', $galat->streamedContent() ?: '');
    }

    public function test_02_eksekusi_menulis_per_potongan(): void
    {
        $f = $this->baseFixture();
        $a = $this->makeSantri('Potong B', '27002', $f['mi']);
        $b = $this->makeSantri('Potong C', '27003', $f['mi']);

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'mode' => 'eksekusi',
            'total' => 2,
            'baris' => [$this->baris('27002', 'MI', '2026/2027')],
        ])->assertStatus(200);
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $a->id)->count());

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'sesi_id' => $satu->json('sesi_id'),
            'mode' => 'eksekusi',
            'terakhir' => true,
            'baris' => [$this->baris('27003', 'MI', '2026/2027')],
        ])->assertStatus(200);
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $b->id)->count());
    }

    public function test_03_sesi_milik_pengguna_lain_ditolak(): void
    {
        $f = $this->baseFixture();
        $lain = $this->makeUser('super_admin', []);

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'mode' => 'periksa',
            'total' => 1,
            'baris' => [$this->baris('27999', 'MI', '2026/2027')],
        ])->assertStatus(200);

        // Lanjut + unduh + batal oleh pengguna lain: 404 semua.
        $this->actingAs($lain, 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'sesi_id' => $satu->json('sesi_id'),
            'mode' => 'periksa',
            'baris' => [$this->baris('27999', 'MI', '2026/2027')],
        ])->assertStatus(404);
        $this->actingAs($lain, 'sanctum')
            ->get("/api/admin/riwayat-belajar/import-potong/{$satu->json('sesi_id')}/galat")->assertStatus(404);
        $this->actingAs($lain, 'sanctum')
            ->post("/api/admin/riwayat-belajar/import-potong/{$satu->json('sesi_id')}/batal")->assertStatus(404);
    }

    public function test_04_mode_beda_dan_batas_potongan_ditolak(): void
    {
        $f = $this->baseFixture();

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'mode' => 'periksa',
            'total' => 1,
            'baris' => [$this->baris('27999', 'MI', '2026/2027')],
        ])->assertStatus(200);

        // Mode berbeda dari sesi.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'sesi_id' => $satu->json('sesi_id'),
            'mode' => 'eksekusi',
            'baris' => [$this->baris('27999', 'MI', '2026/2027')],
        ])->assertStatus(422);

        // Lebih dari 1000 baris per panggilan.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'mode' => 'periksa',
            'total' => 1001,
            'baris' => array_fill(0, 1001, $this->baris('27999', 'MI', '2026/2027')),
        ])->assertStatus(422);
    }

    public function test_05_batal_menghapus_berkas_galat(): void
    {
        $f = $this->baseFixture();

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'mode' => 'periksa',
            'total' => 1,
            'baris' => [$this->baris('27999', 'MI', '2026/2027')],
        ])->assertStatus(200);
        $sesiId = $satu->json('sesi_id');
        $this->assertNotNull(ImportSesi::find($sesiId)->galat_file);

        $this->actingAs($f['super'], 'sanctum')
            ->post("/api/admin/riwayat-belajar/import-potong/{$sesiId}/batal")->assertStatus(200);
        $this->assertSame(ImportSesi::BATAL, ImportSesi::find($sesiId)->status);
        $this->actingAs($f['super'], 'sanctum')
            ->get("/api/admin/riwayat-belajar/import-potong/{$sesiId}/galat")->assertStatus(404);
    }

    // ---------- 06. is_active_riwayat = periode terakhir yang statusnya aktif ----------

    public function test_06_import_hanya_periode_terakhir_yang_aktif(): void
    {
        $f = $this->baseFixture();
        $a = $this->makeSantri('Sinkron A', '27101', $f['mi']); // ganjil + genap aktif
        $b = $this->makeSantri('Sinkron B', '27102', $f['mi']); // ganjil aktif saja
        $c = $this->makeSantri('Sinkron C', '27103', $f['mi']); // ganjil aktif + genap naik

        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/riwayat-belajar/import-potong', [
            'mode' => 'eksekusi',
            'terakhir' => true,
            'total' => 5,
            'baris' => [
                $this->baris('27101', 'MI', '2026/2027'),
                $this->baris('27101', 'MI', '2026/2027', ['semester' => '2']),
                $this->baris('27102', 'MI', '2026/2027'),
                $this->baris('27103', 'MI', '2026/2027'),
                $this->baris('27103', 'MI', '2026/2027', ['semester' => '2', 'status_akhir' => 'naik']),
            ],
        ])->assertStatus(200);

        $aktif = fn (int $id) => RiwayatBelajar::where('santri_id', $id)
            ->where('is_active_riwayat', 'Ya')->orderBy('semester')->pluck('semester')->all();

        // Hanya periode terakhir (genap) yang aktif; ganjil bersejarah diarsipkan.
        $this->assertSame(['2'], $aktif($a->id));
        $this->assertSame(['1'], $aktif($b->id));
        // Periode terakhir 'naik' (sudah selesai) → tak ada baris aktif.
        $this->assertSame([], $aktif($c->id));
        $this->assertSame('Ya', $a->fresh()->is_active_pst);
        $this->assertSame('Tidak', $c->fresh()->is_active_pst);
    }

    // ---------- 07. backfill: arsipkan aktif ganda hasil impor lama ----------

    public function test_07_command_backfill_mengarsipkan_aktif_ganda(): void
    {
        $f = $this->baseFixture();
        $s = $this->makeSantri('Backfill', '27201', $f['mi']);
        // Simulasi hasil impor lama: dua baris aktif untuk pasangan yang sama.
        RiwayatBelajar::create([
            'santri_id' => $s->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => 'MI',
            'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $s->id, 'tahun_ajaran' => $f['ta']->nama, 'jenjang' => 'MI',
            'semester' => '2', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        $this->artisan('riwayat:sinkron-aktif')->assertSuccessful();

        $this->assertSame(['2'], RiwayatBelajar::where('santri_id', $s->id)
            ->where('is_active_riwayat', 'Ya')->pluck('semester')->all());
    }
}
