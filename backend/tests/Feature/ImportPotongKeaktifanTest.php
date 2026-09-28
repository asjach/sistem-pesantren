<?php

namespace Tests\Feature;

use App\Models\ImportSesi;
use App\Models\KeaktifanPegawai;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Import riwayat keaktifan pegawai bertahap (potongan JSON 1000/panggilan):
// periksa kering, eksekusi upsert idempoten, galat per baris, dan lingkup lembaga.
class ImportPotongKeaktifanTest extends TestCase
{
    use RefreshDatabase;

    protected int $userSeq = 0;

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
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $super = $this->makeAdmin([], 'super_admin');

        return compact('mi', 'mts', 'ta', 'super');
    }

    protected function makeAdmin(array $jenjangs, string $role = 'admin'): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Admin '.$this->userSeq,
            'email' => "keaktifan_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9500000000 + $this->userSeq * 37), 10, '0', STR_PAD_LEFT),
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

    protected function buatPegawai(string $nama, ?string $nipp = null, ?string $jenjangPenempatan = 'MI'): Pegawai
    {
        $p = Pegawai::create(['nama_lengkap' => $nama, 'jenis_kelamin' => 'L', 'nipp' => $nipp]);
        if ($jenjangPenempatan !== null) {
            LembagaPegawai::create(['pegawai_id' => $p->id, 'jenjang' => $jenjangPenempatan]);
        }

        return $p;
    }

    protected function baris(array $tambah = []): array
    {
        return array_merge([
            'nipp' => 'PST-001', 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
        ], $tambah);
    }

    public function test_01_template_bisa_diunduh(): void
    {
        $f = $this->baseFixture();

        $res = $this->actingAs($f['super'], 'sanctum')->get('/api/admin/pegawai-keaktifan/import-template');
        $res->assertStatus(200);
        $this->assertStringContainsString('attachment', (string) $res->headers->get('content-disposition'));
    }

    public function test_02_data_existing_bentuk_kolom_dan_baris(): void
    {
        $f = $this->baseFixture();
        $guru = $this->buatPegawai('Ahmad', 'PST-001');
        KeaktifanPegawai::create([
            'pegawai_id' => $guru->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027',
            'tugas_utama' => 'Guru Kelas', 'no_sk' => 'SK/1/2026', 'tgl_sk' => '2026-07-01',
        ]);

        $res = $this->actingAs($f['super'], 'sanctum')->getJson('/api/admin/pegawai-keaktifan/data-existing');
        $res->assertStatus(200);
        $this->assertSame('pegawai_id', $res->json('kolom.0'));
        $this->assertSame('jenjang', $res->json('kolom.3'));
        $this->assertSame('tahun_ajaran', $res->json('kolom.4'));
        $this->assertSame(['jenjang', 'tahun_ajaran'], $res->json('wajib'));
        $baris = $res->json('baris.0');
        $this->assertSame('MI', $baris[3]);
        $this->assertSame('2026/2027', $baris[4]);
        $this->assertSame('Aktif', $baris[6]);
    }

    public function test_03_periksa_kering_tanpa_menulis(): void
    {
        $f = $this->baseFixture();
        $this->buatPegawai('Ahmad', 'PST-001');
        $this->buatPegawai('Budi', 'PST-002');

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/pegawai-keaktifan/import-potong', [
            'mode' => 'periksa',
            'total' => 3,
            'baris' => [
                $this->baris(),
                $this->baris(['nipp' => 'PST-002']),
            ],
        ])->assertStatus(200);

        $sesiId = $satu->json('sesi_id');
        $this->assertSame(2, $satu->json('offset'));
        $this->assertFalse((bool) $satu->json('selesai'));
        $this->assertSame(2, $satu->json('ringkasan.dibuat'));
        $this->assertSame(0, $satu->json('ringkasan.baris_gagal'));
        $this->assertSame(0, KeaktifanPegawai::count());

        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/pegawai-keaktifan/import-potong', [
            'sesi_id' => $sesiId,
            'mode' => 'periksa',
            'terakhir' => true,
            'baris' => [$this->baris(['nipp' => 'PST-002', 'status_keaktifan' => 'Inaktif'])],
        ])->assertStatus(200);

        $this->assertTrue((bool) $dua->json('selesai'));
        $this->assertSame(3, $dua->json('offset'));
        $this->assertSame(3, $dua->json('ringkasan.dibuat'));
        $this->assertSame(0, KeaktifanPegawai::count());
        $this->assertSame(ImportSesi::SELESAI, ImportSesi::find($sesiId)->status);
    }

    public function test_04_eksekusi_upsert_idempoten_dan_hanya_kolom_terisi(): void
    {
        $f = $this->baseFixture();
        $guru = $this->buatPegawai('Ahmad', 'PST-001');

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/pegawai-keaktifan/import-potong', [
            'mode' => 'eksekusi',
            'total' => 3,
            'baris' => [
                $this->baris(),
                $this->baris(['nipp' => 'PST-TIDAK-ADA']),
            ],
        ])->assertStatus(200);

        $this->assertSame(1, $satu->json('ringkasan.dibuat'));
        $this->assertSame(1, $satu->json('ringkasan.baris_gagal'));
        $this->assertSame(1, KeaktifanPegawai::count());

        // Baris cocok: hanya kolom terisi yang menimpa; tugas kosong warisi penempatan.
        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/pegawai-keaktifan/import-potong', [
            'sesi_id' => $satu->json('sesi_id'),
            'mode' => 'eksekusi',
            'terakhir' => true,
            'baris' => [$this->baris(['no_sk' => 'SK/9/2026', 'status_keaktifan' => 'Inaktif'])],
        ])->assertStatus(200);

        $this->assertSame(1, $dua->json('ringkasan.dibuat'));
        $this->assertSame(1, $dua->json('ringkasan.diperbarui'));
        $this->assertSame(1, KeaktifanPegawai::count());

        $row = KeaktifanPegawai::first();
        $this->assertSame('SK/9/2026', $row->no_sk);
        $this->assertSame('inaktif', $row->status_keaktifan);
        $this->assertSame('Guru Pengampu', $row->tugas_utama); // warisi penempatan

        // Sesi baru dengan baris identik (tanpa kolom terisi) = dilewati.
        $tiga = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/pegawai-keaktifan/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$this->baris()],
        ])->assertStatus(200);
        $this->assertSame(0, $tiga->json('ringkasan.dibuat'));
        $this->assertSame(0, $tiga->json('ringkasan.diperbarui'));
        $this->assertSame(1, $tiga->json('ringkasan.baris_dilewati'));
        $this->assertSame(1, KeaktifanPegawai::count());
    }

    public function test_05_galat_per_baris_dan_unduh_csv(): void
    {
        $f = $this->baseFixture();
        $this->buatPegawai('Ahmad', 'PST-001');
        $tanpaTempat = Pegawai::create(['nama_lengkap' => 'Cici', 'jenis_kelamin' => 'P', 'nipp' => 'PST-003']);

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/pegawai-keaktifan/import-potong', [
            'mode' => 'eksekusi',
            'total' => 4,
            'terakhir' => true,
            'baris' => [
                $this->baris(),
                $this->baris(['jenjang' => 'ZZZ']),
                $this->baris(['nipp' => 'PST-003']),
                $this->baris(['nipp' => 'PST-404']),
            ],
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(3, $res->json('ringkasan.baris_gagal'));
        $this->assertTrue((bool) $res->json('galat_unduh'));

        // Pegawai tanpa penempatan → galat jenjang dengan pesan jelas.
        $sesi = ImportSesi::find($res->json('sesi_id'));
        $this->assertFileExists(storage_path('app/'.$sesi->galat_file));
        $isi = (string) file_get_contents(storage_path('app/'.$sesi->galat_file));
        $this->assertStringContainsString('belum ditempatkan', $isi);

        $unduh = $this->actingAs($f['super'], 'sanctum')
            ->get("/api/admin/pegawai-keaktifan/import-potong/{$sesi->id}/galat");
        $unduh->assertStatus(200);

        $batal = $this->actingAs($f['super'], 'sanctum')
            ->post("/api/admin/pegawai-keaktifan/import-potong/{$sesi->id}/batal");
        $batal->assertStatus(200);
        $this->assertSame(ImportSesi::BATAL, ImportSesi::find($sesi->id)->status);
        $this->assertSame(1, KeaktifanPegawai::count()); // tulisan per potongan tetap
    }

    public function test_06_lingkup_lembaga_dan_status_label_kapital(): void
    {
        $f = $this->baseFixture();
        $this->buatPegawai('Ahmad', 'PST-001', 'MI');
        $this->buatPegawai('Budi', 'PST-002', 'MTS');

        $admin = $this->makeAdmin(['MI']);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/pegawai-keaktifan/import-potong', [
            'mode' => 'eksekusi',
            'total' => 3,
            'terakhir' => true,
            'baris' => [
                $this->baris(['nipp' => 'PST-001']),
                $this->baris(['nipp' => 'PST-002', 'jenjang' => 'MTS']),
                $this->baris(['nipp' => 'PST-002', 'jenjang' => 'mts', 'status_keaktifan' => 'TIDAK']),
            ],
        ])->assertStatus(200);

        // Baris MTS di luar lingkup admin MI → gagal per baris (bukan 403).
        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(2, $res->json('ringkasan.baris_gagal'));

        // Label/kapital/alias status diterima ('mts', 'TIDAK').
        $row = KeaktifanPegawai::first();
        $this->assertSame('MI', $row->jenjang);
        $this->assertSame('aktif', $row->status_keaktifan);
    }

    public function test_07_izin_pegawai_ubah_diperlukan(): void
    {
        $f = $this->baseFixture();

        // Tanpa izin pegawai.ubah → 403 oleh middleware route.
        $this->buatPegawai('Ahmad', 'PST-001');
        $guru = $this->makeAdmin(['MI'], 'guru');
        $guru->syncPermissions(['pegawai.lihat']);

        $this->actingAs($guru, 'sanctum')->postJson('/api/admin/pegawai-keaktifan/import-potong', [
            'mode' => 'periksa',
            'total' => 1,
            'baris' => [$this->baris()],
        ])->assertStatus(403);
    }
}
