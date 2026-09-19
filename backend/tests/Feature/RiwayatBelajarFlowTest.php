<?php

namespace Tests\Feature;

use App\Exports\RiwayatBelajarTemplateExport;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Halaman Riwayat Belajar: tabel + dialog input + import Excel terpisah.
 * Pencocokan import: `nik` → fallback `nis_lokal` + `lembaga_id`.
 */
class RiwayatBelajarFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected const HEADERS = ['nik', 'nis_lokal', 'lembaga_id', 'tahun_ajaran_id', 'kelas_id', 'semester', 'tgl_masuk', 'no_absen', 'tingkat', 'status_awal', 'status_akhir'];

    // ---------- helpers ----------

    protected function baseFixture(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI', 'nsm' => '123456789012',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD', 'nsm' => '123456789013',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $taMi = TahunAjaran::create([
            'lembaga_id' => $mi->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMd = TahunAjaran::create([
            'lembaga_id' => $md->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $kelasMi = Kelas::create([
            'lembaga_id' => $mi->id, 'tahun_ajaran_id' => $taMi->id, 'nama_kelas' => '1A', 'tingkat' => '1',
        ]);
        $kelasMd = Kelas::create([
            'lembaga_id' => $md->id, 'tahun_ajaran_id' => $taMd->id, 'nama_kelas' => 'MD-A', 'tingkat' => '1',
        ]);

        return compact('root', 'mi', 'md', 'taMi', 'taMd', 'kelasMi', 'kelasMd');
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role = 'super_admin', array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'User '.$this->userSeq,
            'email' => "riwayat102_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9300000000 + $this->userSeq * 71 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'lembaga_id' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected int $santriSeq = 0;

    protected function makeSantri(string $nama, ?string $nik = null): Santri
    {
        $this->santriSeq++;

        return Santri::create([
            'nama_lengkap' => $nama.' '.$this->santriSeq,
            'jk' => 'L',
            'nik' => $nik,
        ]);
    }

    protected function makeCsv(array $rows): string
    {
        $tmp = tempnam(sys_get_temp_dir(), 'riwayat102').'.csv';
        $h = fopen($tmp, 'w');
        fputcsv($h, self::HEADERS);
        foreach ($rows as $r) {
            $line = [];
            foreach (self::HEADERS as $col) {
                $line[] = $r[$col] ?? '';
            }
            fputcsv($h, $line);
        }
        fclose($h);

        return $tmp;
    }

    protected function importCsv(User $admin, string $csvPath)
    {
        return $this->actingAs($admin, 'sanctum')->post('/api/admin/riwayat-belajar/import-lengkap', [
            'file' => new UploadedFile($csvPath, 'riwayat.csv', 'text/csv', null, true),
        ]);
    }

    // ---------- 01. dialog: terima santri ----------

    public function test_01_dialog_terima_membuat_keanggotaan_dan_riwayat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Terima Satu');

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $santri->id,
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
            'kelas_id' => $f['kelasMi']->id,
            'tingkat' => '1',
            'no_absen' => 1,
            'status_awal' => 'santri_baru',
            'tgl_masuk' => '2026-07-01',
            'nis_lokal' => '26001',
        ])->assertStatus(201);

        $this->assertDatabaseHas('lembaga_santri', [
            'santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '26001', 'is_active' => true,
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran_id' => $f['taMi']->id, 'kelas_id' => $f['kelasMi']->id,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_aktif' => true,
        ]);
        $this->assertTrue((bool) $santri->fresh()->status_global);
        $this->assertSame($santri->id, $res->json('data.santri_id'));
    }

    // ---------- 02. validasi dialog ----------

    public function test_02_dialog_validasi_ta_dan_kelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Terima Dua');

        // TA milik lembaga lain → 422.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $santri->id,
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMd']->id,
        ])->assertStatus(422);

        // Kelas milik lembaga lain → 422.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $santri->id,
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
            'kelas_id' => $f['kelasMd']->id,
        ])->assertStatus(422);

        $this->assertSame(0, RiwayatBelajar::count());
    }

    public function test_03_dialog_menolak_riwayat_aktif_ganda(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Terima Tiga');

        $payload = [
            'santri_id' => $santri->id,
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
        ];
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', $payload)->assertStatus(201);
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', $payload)->assertStatus(422);

        $this->assertSame(1, RiwayatBelajar::count());
    }

    // ---------- 04. index filter ----------

    public function test_04_index_filter_dan_tenant(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $santriMi = $this->makeSantri('Roster MI');
        RiwayatBelajar::create([
            'santri_id' => $santriMi->id, 'tahun_ajaran_id' => $f['taMi']->id, 'lembaga_id' => $f['mi']->id,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_aktif' => true,
        ]);
        $santriMd = $this->makeSantri('Roster MD');
        RiwayatBelajar::create([
            'santri_id' => $santriMd->id, 'tahun_ajaran_id' => $f['taMd']->id, 'lembaga_id' => $f['md']->id,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_aktif' => true,
        ]);

        $res = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/riwayat-belajar?tanpa_kelas=1')->assertStatus(200);
        $this->assertSame(2, $res->json('total'));

        $arsip = $this->actingAs($adminMi, 'sanctum')
            ->getJson('/api/admin/riwayat-belajar?is_aktif=0&status_akhir=aktif')
            ->assertStatus(200);
        $this->assertSame(0, $arsip->json('total'));
    }

    // ---------- 05. template ----------

    public function test_05_template_riwayat_mengikuti_kolom_tabel(): void
    {
        $this->baseFixture();
        $admin = $this->makeUser();

        $export = new RiwayatBelajarTemplateExport;
        $this->assertSame(self::HEADERS, $export->headings());
        $this->assertNotContains('nis', $export->headings());
        $this->assertSame(count($export->headings()), count($export->array()[0]));

        $this->actingAs($admin, 'sanctum')->get('/api/admin/riwayat-belajar/import-template')->assertStatus(200);
    }

    // ---------- 06-07. import: nik & fallback nis_lokal ----------

    public function test_06_import_cocok_via_nik_membuat_keanggotaan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Impor NIK', '1101010000000201');

        $csv = $this->makeCsv([[
            'nik' => '1101010000000201',
            'nis_lokal' => '26011',
            'lembaga_id' => (string) $f['mi']->id,
            'tahun_ajaran_id' => (string) $f['taMi']->id,
            'kelas_id' => '1A',
            'semester' => '1',
            'tgl_masuk' => '2026-07-01',
            'no_absen' => '3',
            'tingkat' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
        ]]);
        $this->importCsv($admin, $csv)->assertStatus(200);

        $this->assertDatabaseHas('lembaga_santri', [
            'santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '26011', 'is_active' => true,
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'kelas_id' => $f['kelasMi']->id, 'no_absen' => 3, 'is_aktif' => true,
        ]);
        $this->assertTrue((bool) $santri->fresh()->status_global);
    }

    public function test_07_import_fallback_nis_lokal_dan_lembaga(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Impor NIS Lokal');
        LembagaSantri::create([
            'santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '26012', 'is_active' => true,
        ]);

        $csv = $this->makeCsv([[
            'nis_lokal' => '26012',
            'lembaga_id' => (string) $f['mi']->id,
            'tahun_ajaran_id' => (string) $f['taMi']->id,
            'semester' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
        ]]);
        $this->importCsv($admin, $csv)->assertStatus(200);

        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'is_aktif' => true]);
    }

    // ---------- 08. import dry-run + kegagalan baris ----------

    public function test_08_import_periksa_dry_run_dan_gagal_baris(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Periksa Satu', '1101010000000202');

        $csv = $this->makeCsv([
            // valid
            ['nik' => '1101010000000202', 'lembaga_id' => (string) $f['mi']->id, 'tahun_ajaran_id' => (string) $f['taMi']->id, 'semester' => '1'],
            // santri tidak ditemukan
            ['nik' => '1101010000000299', 'lembaga_id' => (string) $f['mi']->id, 'tahun_ajaran_id' => (string) $f['taMi']->id, 'semester' => '1'],
            // TA bukan milik lembaga
            ['nik' => '1101010000000202', 'lembaga_id' => (string) $f['mi']->id, 'tahun_ajaran_id' => (string) $f['taMd']->id, 'semester' => '1'],
            // kelas lintas lingkup
            ['nik' => '1101010000000202', 'lembaga_id' => (string) $f['mi']->id, 'tahun_ajaran_id' => (string) $f['taMi']->id, 'kelas_id' => 'MD-A', 'semester' => '1'],
        ]);

        $res = $this->actingAs($admin, 'sanctum')->post('/api/admin/riwayat-belajar/import-periksa', [
            'file' => new UploadedFile($csv, 'periksa.csv', 'text/csv', null, true),
        ])->assertStatus(200);

        $res->assertJsonPath('siap_import', false)
            ->assertJsonPath('ringkasan.baris_valid', 1)
            ->assertJsonPath('ringkasan.baris_gagal', 3);
        $this->assertSame(0, RiwayatBelajar::count());
    }

    // ---------- 09. no_absen bentrok ----------

    public function test_09_import_no_absen_bentrok_gagal_baris(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $a = $this->makeSantri('Absen A', '1101010000000203');
        $b = $this->makeSantri('Absen B', '1101010000000204');

        $csv = $this->makeCsv([
            ['nik' => '1101010000000203', 'lembaga_id' => (string) $f['mi']->id, 'tahun_ajaran_id' => (string) $f['taMi']->id, 'kelas_id' => '1A', 'semester' => '1', 'no_absen' => '1'],
            ['nik' => '1101010000000204', 'lembaga_id' => (string) $f['mi']->id, 'tahun_ajaran_id' => (string) $f['taMi']->id, 'kelas_id' => '1A', 'semester' => '1', 'no_absen' => '1'],
        ]);
        $res = $this->importCsv($admin, $csv)->assertStatus(422);
        $this->assertStringContainsString('no_absen', (string) json_encode($res->json('errors')));

        $this->assertSame(1, RiwayatBelajar::count());
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $a->id)->count());
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $b->id)->count());
    }

    // ---------- 10. import memperbarui baris yang sudah ada ----------

    public function test_10_import_memperbarui_riwayat_existing(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Update Riwayat', '1101010000000205');
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran_id' => $f['taMi']->id, 'lembaga_id' => $f['mi']->id,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_aktif' => true,
        ]);

        $csv = $this->makeCsv([[
            'nik' => '1101010000000205',
            'lembaga_id' => (string) $f['mi']->id,
            'tahun_ajaran_id' => (string) $f['taMi']->id,
            'kelas_id' => '1A',
            'semester' => '1',
            'no_absen' => '5',
            'tingkat' => '1',
            'status_awal' => 'pindahan',
            'status_akhir' => 'aktif',
        ]]);
        $this->importCsv($admin, $csv)->assertStatus(200);

        $this->assertSame(1, RiwayatBelajar::count());
        $riwayat = RiwayatBelajar::firstOrFail();
        $this->assertSame($f['kelasMi']->id, (int) $riwayat->kelas_id);
        $this->assertSame(5, (int) $riwayat->no_absen);
        $this->assertSame('pindahan', $riwayat->status_awal);
    }

    // ---------- 11. status akhir non-aktif ----------

    public function test_11_import_status_akhir_nonaktif_menonaktifkan_santri(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Arsip Riwayat', '1101010000000206');

        $csv = $this->makeCsv([[
            'nik' => '1101010000000206',
            'lembaga_id' => (string) $f['mi']->id,
            'tahun_ajaran_id' => (string) $f['taMi']->id,
            'semester' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'pindah_keluar',
        ]]);
        $this->importCsv($admin, $csv)->assertStatus(200);

        $riwayat = RiwayatBelajar::firstOrFail();
        $this->assertSame('pindah_keluar', $riwayat->status_akhir);
        $this->assertFalse((bool) $riwayat->is_aktif);
        $this->assertFalse((bool) $santri->fresh()->status_global);
    }

    public function test_12_tingkat_mewarisi_kelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();

        // Terima tanpa tingkat eksplisit → warisi kelas.tingkat.
        $s = $this->makeSantri('Waris Tingkat', '1101010000000210');
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $s->id, 'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id, 'kelas_id' => $f['kelasMi']->id,
        ])->assertStatus(201);
        $this->assertSame('1', $res->json('data.tingkat'));

        // Set kelas menyusul pada riwayat tanpa tingkat → warisi juga.
        $s2 = $this->makeSantri('Waris Susul', '1101010000000211');
        $r2 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $s2->id, 'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id,
        ])->assertStatus(201)->json('data');
        $this->assertNull($r2['tingkat']);
        $set = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/riwayat-belajar/{$r2['id']}/set-kelas", ['kelas_id' => $f['kelasMi']->id]
        )->assertStatus(200);
        $this->assertSame('1', $set->json('data.tingkat') ?? $set->json('tingkat'));

        // Tingkat eksplisit yang bentrok tetap ditolak (bukan ditimpa).
        $s3 = $this->makeSantri('Tolak Bentrok', '1101010000000212');
        $r3 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $s3->id, 'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_id' => $f['taMi']->id, 'tingkat' => '2',
        ])->assertStatus(201)->json('data');
        $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/riwayat-belajar/{$r3['id']}/set-kelas", ['kelas_id' => $f['kelasMi']->id]
        )->assertStatus(422);
    }
}
