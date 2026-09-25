<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKegiatan;
use App\Models\PsbLogStatus;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Import PSB bertahap (potongan JSON 1000 baris): `gelombang_id` + `jenjang`
// adalah konteks tetap sesi dan wajib tiap potongan; mode periksa menjalankan
// SEMUA cek tanpa menulis pendaftar/log status/nomor pendaftaran; eksekusi
// menulis per potongan; NIK duplikat dilaporkan per baris.
class ImportPotongPsbTest extends TestCase
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
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $keg = PsbKegiatan::create([
            'tahun_ajaran' => $ta->nama, 'nama' => 'PSB 2026/2027', 'is_aktif' => true,
        ]);
        $gel = PsbGelombang::create([
            'psb_kegiatan_id' => $keg->id, 'nomor' => 1, 'nama' => 'Gelombang 1',
            'tgl_buka' => now()->subDays(30)->toDateString(),
            'tgl_tutup' => now()->addDays(30)->toDateString(),
        ]);
        $admin = $this->makeUser('admin', [$mi->jenjang]);

        return compact('mi', 'ta', 'keg', 'gel', 'admin');
    }

    protected function makeUser(string $role, array $jenjangs): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Psb '.$this->userSeq,
            'email' => "psb_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9800000000 + $this->userSeq * 97), 10, '0', STR_PAD_LEFT),
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

    protected function baris(string $nik, string $nama, array $tambah = []): array
    {
        return array_merge([
            'nik' => $nik, 'nama_lengkap' => $nama, 'jk' => 'L',
            'tgl_lahir' => '2015-01-01', 'tipe_santri' => 'non_asrama',
        ], $tambah);
    }

    /** @return array<string, mixed> */
    protected function konteks(array $f, array $tambah = []): array
    {
        return $tambah + ['gelombang_id' => $f['gel']->id, 'jenjang' => $f['mi']->jenjang];
    }

    public function test_01_periksa_kering_tidak_menulis_sama_sekali(): void
    {
        $f = $this->baseFixture();

        $res = $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', $this->konteks($f, [
            'mode' => 'periksa',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->baris('1100000000000501', 'Calon Satu'),
                $this->baris('BUKAN-NIK', 'Calon Dua'),
            ],
        ]))->assertStatus(200);

        $this->assertSame(2, $res->json('offset'));
        $this->assertTrue((bool) $res->json('selesai'));
        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame('nik', $res->json('galat_contoh.0.kolom'));

        // Kering: tak ada pendaftar, log status, maupun nomor pendaftaran.
        $this->assertSame(0, PsbCalonSantri::withTrashed()->count());
        $this->assertSame(0, PsbLogStatus::count());
        $this->assertSame(0, DB::table('psb_calon_lembaga')->count());
    }

    public function test_02_eksekusi_menulis_per_potongan_dengan_konteks(): void
    {
        $f = $this->baseFixture();

        $satu = $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', $this->konteks($f, [
            'mode' => 'eksekusi',
            'total' => 3,
            'baris' => [$this->baris('1100000000000502', 'Calon Tiga')],
        ]))->assertStatus(200);
        $this->assertFalse((bool) $satu->json('selesai'));
        $this->assertSame(1, PsbCalonSantri::count());

        // Gelombang + lembaga ikut pada potongan lanjutan.
        $dua = $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', $this->konteks($f, [
            'sesi_id' => $satu->json('sesi_id'),
            'mode' => 'eksekusi',
            'terakhir' => true,
            'baris' => [$this->baris('1100000000000503', 'Calon Empat')],
        ]))->assertStatus(200);

        $this->assertSame(2, $dua->json('offset'));
        $this->assertTrue((bool) $dua->json('selesai'));
        $this->assertSame(2, PsbCalonSantri::count());
        foreach (PsbCalonSantri::all() as $calon) {
            $this->assertSame($f['gel']->id, $calon->gelombang_id);
            $this->assertSame($f['mi']->jenjang, $calon->jenjang);
            $this->assertSame($f['ta']->nama, $calon->tahun_ajaran);
            $this->assertSame('baru', $calon->status_pendaftaran);
            $this->assertStringStartsWith('PSB_', (string) $calon->no_pendaftaran);
        }
        $this->assertSame(2, PsbLogStatus::count());
    }

    public function test_03_konteks_wajib_tiap_potongan(): void
    {
        $f = $this->baseFixture();

        // Tanpa gelombang_id / jenjang → 422.
        $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', [
            'mode' => 'eksekusi', 'total' => 1, 'terakhir' => true,
            'baris' => [$this->baris('1100000000000504', 'Calon Lima')],
        ])->assertStatus(422);

        // Potongan lanjutan tanpa konteks juga 422.
        $satu = $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', $this->konteks($f, [
            'mode' => 'eksekusi', 'total' => 2,
            'baris' => [$this->baris('1100000000000505', 'Calon Enam')],
        ]))->assertStatus(200);
        $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', [
            'sesi_id' => $satu->json('sesi_id'), 'mode' => 'eksekusi', 'terakhir' => true,
            'baris' => [$this->baris('1100000000000506', 'Calon Tujuh')],
        ])->assertStatus(422);
    }

    public function test_04_lembaga_di_luar_lingkup_akun_ditolak(): void
    {
        $f = $this->baseFixture();
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => true, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);

        $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', [
            'gelombang_id' => $f['gel']->id, 'jenjang' => $mts->jenjang,
            'mode' => 'eksekusi', 'total' => 1, 'terakhir' => true,
            'baris' => [$this->baris('1100000000000507', 'Calon Delapan')],
        ])->assertStatus(403);

        $this->assertSame(0, PsbCalonSantri::count());
    }

    public function test_05_batas_1000_dan_nomor_pendaftaran_duplikat(): void
    {
        $f = $this->baseFixture();
        PsbCalonSantri::create([
            'jenjang' => $f['mi']->jenjang, 'gelombang_id' => $f['gel']->id,
            'tahun_ajaran' => $f['ta']->nama, 'nik' => '1100000000000508',
            'nama_lengkap' => 'Sudah Ada', 'no_pendaftaran' => 'PSB_MANUAL_0001',
            'status_pendaftaran' => 'baru', 'tanggal_daftar' => now()->toDateString(),
        ]);

        $res = $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', $this->konteks($f, [
            'mode' => 'eksekusi',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->baris('1100000000000512', 'Bentrok', ['no_pendaftaran' => 'PSB_MANUAL_0001']),
                $this->baris('1100000000000509', 'Calon Sembilan'),
            ],
        ]))->assertStatus(200);

        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame('no_pendaftaran', $res->json('galat_contoh.0.kolom'));
        // Baris bentrok tak tertulis: hanya pre-existing + 1 hasil import.
        $this->assertSame(2, PsbCalonSantri::count());
        $this->assertSame(0, PsbCalonSantri::where('nik', '1100000000000512')->count());
        $this->assertSame(1, PsbCalonSantri::where('no_pendaftaran', 'PSB_MANUAL_0001')->count());

        // Lebih dari 1000 baris per panggilan.
        $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', $this->konteks($f, [
            'mode' => 'periksa',
            'total' => 1001,
            'baris' => array_fill(0, 1001, $this->baris('1100000000000510', 'Banjiri')),
        ]))->assertStatus(422);
    }

    public function test_06_sesi_milik_pengguna_lain_ditolak(): void
    {
        $f = $this->baseFixture();
        $lain = $this->makeUser('admin', [$f['mi']->jenjang]);

        $satu = $this->actingAs($f['admin'], 'sanctum')->postJson('/api/psb/import-potong', $this->konteks($f, [
            'mode' => 'periksa',
            'total' => 1,
            'baris' => [$this->baris('BUKAN-NIK', 'Calon Sepuluh')],
        ]))->assertStatus(200);
        $sesiId = $satu->json('sesi_id');

        $this->actingAs($lain, 'sanctum')->postJson('/api/psb/import-potong', $this->konteks($f, [
            'sesi_id' => $sesiId, 'mode' => 'periksa',
            'baris' => [$this->baris('1100000000000511', 'Calon Sebelas')],
        ]))->assertStatus(404);
        $this->actingAs($lain, 'sanctum')->get("/api/psb/import-potong/{$sesiId}/galat")->assertStatus(404);
        $this->actingAs($lain, 'sanctum')->post("/api/psb/import-potong/{$sesiId}/batal")->assertStatus(404);

        // Pemilik boleh membatalkan (dan berkas galatnya hilang).
        $this->actingAs($f['admin'], 'sanctum')->post("/api/psb/import-potong/{$sesiId}/batal")->assertStatus(200);
        $this->actingAs($f['admin'], 'sanctum')->get("/api/psb/import-potong/{$sesiId}/galat")->assertStatus(404);
    }
}
