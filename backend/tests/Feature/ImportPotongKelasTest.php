<?php

namespace Tests\Feature;

use App\Models\ImportSesi;
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

// Import kelas bertahap (potongan JSON 1000 baris): sesi + offset +
// akumulator, periksa kering tanpa menulis, eksekusi menulis per
// potongan, upsert idempoten, galat CSV bisa diunduh.
class ImportPotongKelasTest extends TestCase
{
    use RefreshDatabase;

    protected int $userSeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(ReferensiSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
        // Id sesi mulai dari 1 di tiap tes → berkas galat lama tak boleh bocor.
        $this->hapusBerkasGalat();
    }

    protected function hapusBerkasGalat(): void
    {
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
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $super = $this->makeUser('super_admin', []);

        return compact('mi', 'ta', 'super');
    }

    protected function makeUser(string $role, array $jenjangs): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Kelas '.$this->userSeq,
            'email' => "kelas_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9600000000 + $this->userSeq * 71), 10, '0', STR_PAD_LEFT),
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

    protected function baris(string $nama, string $jenjang = 'MI', string $ta = '2026/2027', array $tambah = []): array
    {
        return array_merge([
            'nama_kelas' => $nama, 'jenjang' => $jenjang, 'tahun_ajaran' => $ta,
        ], $tambah);
    }

    public function test_01_periksa_kering_tanpa_menulis(): void
    {
        $f = $this->baseFixture();

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'mode' => 'periksa',
            'total' => 3,
            'baris' => [
                $this->baris('1A'),
                $this->baris('1B'),
            ],
        ])->assertStatus(200);

        $sesiId = $satu->json('sesi_id');
        $this->assertSame(2, $satu->json('offset'));
        $this->assertFalse((bool) $satu->json('selesai'));
        $this->assertSame(2, $satu->json('ringkasan.dibuat'));
        $this->assertSame(0, $satu->json('ringkasan.baris_gagal'));
        $this->assertSame(0, Kelas::count());

        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'sesi_id' => $sesiId,
            'mode' => 'periksa',
            'terakhir' => true,
            'baris' => [$this->baris('1C')],
        ])->assertStatus(200);

        $this->assertTrue((bool) $dua->json('selesai'));
        $this->assertSame(3, $dua->json('offset'));
        $this->assertSame(3, $dua->json('ringkasan.dibuat'));
        $this->assertSame(0, Kelas::count());
        $this->assertSame(ImportSesi::SELESAI, ImportSesi::find($sesiId)->status);
    }

    public function test_02_eksekusi_menulis_per_potongan_dan_idempoten(): void
    {
        $f = $this->baseFixture();

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'mode' => 'eksekusi',
            'total' => 3,
            'baris' => [$this->baris('1A'), $this->baris('1B')],
        ])->assertStatus(200);
        $this->assertFalse((bool) $satu->json('selesai'));
        $this->assertSame(2, $satu->json('ringkasan.dibuat'));
        $this->assertSame(2, Kelas::count());

        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'sesi_id' => $satu->json('sesi_id'),
            'mode' => 'eksekusi',
            'terakhir' => true,
            'baris' => [$this->baris('1B', tambah: ['nama_alias' => 'Kelas Satu B'])],
        ])->assertStatus(200);

        $this->assertSame(2, $dua->json('ringkasan.dibuat'));
        $this->assertSame(1, $dua->json('ringkasan.diperbarui'));
        $this->assertSame(2, Kelas::count());
        $this->assertSame('Kelas Satu B', Kelas::where('nama_kelas', '1B')->value('nama_alias'));

        // Sesi baru dengan baris identik = dilewati, tak menggandakan.
        $tiga = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$this->baris('1A')],
        ])->assertStatus(200);
        $this->assertSame(0, $tiga->json('ringkasan.dibuat'));
        $this->assertSame(0, $tiga->json('ringkasan.diperbarui'));
        $this->assertSame(1, $tiga->json('ringkasan.baris_dilewati'));
        $this->assertSame(2, Kelas::count());
    }

    public function test_03_galat_per_baris_dan_unduh_csv(): void
    {
        $f = $this->baseFixture();

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'mode' => 'eksekusi',
            'total' => 3,
            'terakhir' => true,
            'baris' => [
                $this->baris('1A'),
                $this->baris('1B', jenjang: 'ZZZ'),
                $this->baris('1C', ta: '1900/1901'),
            ],
        ])->assertStatus(200);

        $this->assertSame(1, $satu->json('ringkasan.dibuat'));
        $this->assertSame(2, $satu->json('ringkasan.baris_gagal'));
        $this->assertTrue((bool) $satu->json('galat_unduh'));
        $this->assertSame(2, count($satu->json('galat_contoh')));
        $this->assertSame(1, Kelas::count());

        $galat = $this->actingAs($f['super'], 'sanctum')
            ->get("/api/admin/kelas/import-potong/{$satu->json('sesi_id')}/galat");
        $galat->assertStatus(200);
        $isi = $galat->streamedContent() ?: '';
        $this->assertStringContainsString('Lembaga tidak valid', $isi);
        $this->assertStringContainsString('Tahun ajaran tidak berlaku', $isi);
        // Nomor galat absolut: baris 3 dan 4 (heading = 1).
        $this->assertStringContainsString('3,', $isi);
        $this->assertStringContainsString('4,', $isi);
    }

    public function test_04_batas_1000_baris_dan_kunci_sesi(): void
    {
        $f = $this->baseFixture();

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'mode' => 'periksa',
            'total' => 1,
            'baris' => [$this->baris('1A')],
        ])->assertStatus(200);
        $sesiId = $satu->json('sesi_id');

        // Lebih dari 1000 baris per panggilan.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'mode' => 'periksa',
            'total' => 1001,
            'baris' => array_fill(0, 1001, $this->baris('1A')),
        ])->assertStatus(422);

        // Mode berbeda dari sesi.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'sesi_id' => $sesiId,
            'mode' => 'eksekusi',
            'baris' => [$this->baris('1A')],
        ])->assertStatus(422);

        // Sesi milik pengguna lain: 404 untuk lanjut/batal/unduh.
        $lain = $this->makeUser('super_admin', []);
        $this->actingAs($lain, 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'sesi_id' => $sesiId,
            'mode' => 'periksa',
            'baris' => [$this->baris('1A')],
        ])->assertStatus(404);
        $this->actingAs($lain, 'sanctum')
            ->get("/api/admin/kelas/import-potong/{$sesiId}/galat")->assertStatus(404);
        $this->actingAs($lain, 'sanctum')
            ->post("/api/admin/kelas/import-potong/{$sesiId}/batal")->assertStatus(404);
    }

    public function test_05_izin_per_baris_di_luar_lingkup_akun(): void
    {
        $mi = Lembaga::create([
            'nama' => 'Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $admin = $this->makeUser('admin', [$mi->jenjang]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'mode' => 'eksekusi',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->baris('1A', jenjang: $mi->jenjang),
                $this->baris('1A', jenjang: $mts->jenjang),
            ],
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame('Lembaga di luar lingkup akses Anda.', $res->json('galat_contoh.0.pesan'));
        $this->assertSame(1, Kelas::count());
        $this->assertSame($mi->jenjang, Kelas::first()->jenjang);
    }

    public function test_06_tingkat_tak_dikenal_dan_baris_kosong_dilewati(): void
    {
        $f = $this->baseFixture();
        // Kamus tingkat terisi → tingkat di luar kamus ditolak per baris.
        DB::table('ref_tingkat')->insert([
            'jenjang' => 'MI', 'nama' => '1', 'urutan' => 1, 'is_active' => true,
        ]);

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/kelas/import-potong', [
            'mode' => 'eksekusi',
            'total' => 3,
            'terakhir' => true,
            'baris' => [
                ['nama_kelas' => '', 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027'],
                $this->baris('1A'),
                $this->baris('1B', tambah: ['tingkat' => 'TIDAK-ADA']),
            ],
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame('tingkat', $res->json('galat_contoh.0.kolom'));
        $this->assertSame('Tingkat tidak dikenal.', $res->json('galat_contoh.0.pesan'));
        // Baris kosong tak menambah apa pun (tak valid, tak gagal).
        $this->assertSame(1, $res->json('ringkasan.baris_dilewati'));
        $this->assertSame(1, Kelas::count());
    }
}
