<?php

namespace Tests\Feature;

use App\Exports\RiwayatBelajarTemplateExport;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\LembagaTahunAjaran;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * Halaman Riwayat Belajar: tabel + dialog input + import Excel terpisah.
 * Pencocokan import: `nis_lokal` + `jenjang` (unik per lembaga).
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

    protected const HEADERS = ['nis_lokal', 'jenjang', 'tahun_ajaran', 'kelas_id', 'semester', 'tgl_masuk', 'no_absen', 'tingkat', 'status_awal', 'status_akhir'];

    // ---------- helpers ----------

    protected function baseFixture(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'jenjang' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'nsm' => '123456789012',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD', 'nsm' => '123456789013',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        // TA global (berlaku semua lembaga).
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMi = $taMd = $ta;
        // TA lama disembunyikan untuk MI → tidak berlaku di lembaga itu.
        $taLama = TahunAjaran::create([
            'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => false,
        ]);
        LembagaTahunAjaran::create([
            'jenjang' => $mi->jenjang, 'tahun_ajaran' => $taLama->nama, 'is_active' => false,
        ]);
        $kelasMi = Kelas::create([
            'jenjang' => $mi->jenjang, 'tahun_ajaran' => $taMi->nama, 'nama_kelas' => '1A', 'tingkat' => '1',
        ]);
        $kelasMd = Kelas::create([
            'jenjang' => $md->jenjang, 'tahun_ajaran' => $taMd->nama, 'nama_kelas' => 'MD-A', 'tingkat' => '1',
        ]);
        // Kamus status per lembaga (label ↔ kode untuk import).
        foreach ([$mi->jenjang, $md->jenjang] as $jenjang) {
            foreach ([
                ['kode' => 'santri_baru', 'nama' => 'Santri Baru'],
                ['kode' => 'pindahan', 'nama' => 'Pindahan'],
                ['kode' => 'kenaikan', 'nama' => 'Kenaikan Kelas'],
            ] as $i => $r) {
                DB::table('ref_status_awal')->updateOrInsert(
                    ['jenjang' => $jenjang, 'kode' => $r['kode']],
                    ['nama' => $r['nama'], 'urutan' => $i, 'is_active' => true]
                );
            }
            foreach ([
                ['kode' => 'aktif', 'nama' => 'Aktif'],
                ['kode' => 'naik', 'nama' => 'Naik'],
                ['kode' => 'pindah_keluar', 'nama' => 'Pindah/Keluar'],
            ] as $i => $r) {
                DB::table('ref_status_akhir')->updateOrInsert(
                    ['jenjang' => $jenjang, 'kode' => $r['kode']],
                    ['nama' => $r['nama'], 'is_aktif_bawaan' => $r['kode'] === 'aktif', 'terminal_ke' => null, 'urutan' => $i, 'is_active' => true]
                );
            }
        }
        Cache::flush();

        return compact('root', 'mi', 'md', 'taMi', 'taMd', 'taLama', 'kelasMi', 'kelasMd');
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
                'user_id' => $u->id, 'jenjang' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected int $santriSeq = 0;

    protected function makeSantri(string $nama, ?string $nisLokal = null, ?Lembaga $lembaga = null): Santri
    {
        $this->santriSeq++;

        $santri = Santri::create([
            'nama_lengkap' => $nama.' '.$this->santriSeq,
            'jk' => 'L',
        ]);
        if ($nisLokal !== null && $lembaga !== null) {
            LembagaSantri::create([
                'santri_id' => $santri->id, 'jenjang' => $lembaga->jenjang,
                'nis_lokal' => $nisLokal, 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
            ]);
        }

        return $santri;
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
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
            'kelas_id' => $f['kelasMi']->id,
            'tingkat' => '1',
            'no_absen' => 1,
            'status_awal' => 'santri_baru',
            'tgl_masuk' => '2026-07-01',
            'nis_lokal' => '26001',
        ])->assertStatus(201);

        $this->assertDatabaseHas('lembaga_santri', [
            'santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '26001', 'is_active_lembaga' => 'Ya',
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['taMi']->nama, 'kelas_id' => $f['kelasMi']->id,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);
        $this->assertSame('Ya', $santri->fresh()->is_active_pst);
        $this->assertSame($santri->id, $res->json('data.santri_id'));
    }

    // ---------- 02. validasi dialog ----------

    public function test_02_dialog_validasi_ta_dan_kelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Terima Dua');

        // TA disembunyikan untuk lembaga ini → 422.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $santri->id,
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taLama']->nama,
        ])->assertStatus(422);

        // Kelas milik lembaga lain → 422.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $santri->id,
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
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
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
        ];
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', $payload)->assertStatus(201);
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', $payload)->assertStatus(422);

        $this->assertSame(1, RiwayatBelajar::count());
    }

    // ---------- 04. index filter ----------

    public function test_04_index_filter_dan_tenant(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);

        $santriMi = $this->makeSantri('Roster MI');
        RiwayatBelajar::create([
            'santri_id' => $santriMi->id, 'tahun_ajaran' => $f['taMi']->nama, 'jenjang' => $f['mi']->jenjang,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);
        $santriMd = $this->makeSantri('Roster MD');
        RiwayatBelajar::create([
            'santri_id' => $santriMd->id, 'tahun_ajaran' => $f['taMd']->nama, 'jenjang' => $f['md']->jenjang,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        $res = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/riwayat-belajar?tanpa_kelas=1')->assertStatus(200);
        $this->assertSame(2, $res->json('total'));

        $arsip = $this->actingAs($adminMi, 'sanctum')
            ->getJson('/api/admin/riwayat-belajar?is_active_riwayat=0&status_akhir=aktif')
            ->assertStatus(200);
        $this->assertSame(0, $arsip->json('total'));
    }

    // ---------- 05. template ----------

    public function test_05_template_riwayat_mengikuti_kolom_tabel(): void
    {
        $this->baseFixture();
        $admin = $this->makeUser();

        $export = new RiwayatBelajarTemplateExport;
        // Kunci hanya nis_lokal + jenjang (tanpa nik).
        $this->assertSame(
            ['nis_lokal', 'jenjang', 'tahun_ajaran', 'nama_kelas', 'semester', 'tgl_masuk', 'no_absen', 'tingkat', 'status_awal', 'status_akhir'],
            $export->headings()
        );
        // Dropdown status memakai label Proper Case, bukan kode.
        $this->assertContains('Santri Baru', $export->pilihan()['status_awal']);
        $this->assertContains('Aktif', $export->pilihan()['status_akhir']);
        $this->assertNotContains('nis', $export->headings());
        $this->assertSame(count($export->headings()), count($export->array()[0]));

        $this->actingAs($admin, 'sanctum')->get('/api/admin/riwayat-belajar/import-template')->assertStatus(200);
    }

    // ---------- 06-07. import: kunci nis_lokal ----------

    public function test_06_import_cocok_nis_lokal_membuat_riwayat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        // Kunci hanya NIS lokal + lembaga: santri dikenali via keanggotaannya.
        $santri = $this->makeSantri('Impor NIS', '26011', $f['mi']);

        $csv = $this->makeCsv([[
            'nis_lokal' => '26011',
            'jenjang' => (string) $f['mi']->jenjang,
            'tahun_ajaran' => (string) $f['taMi']->nama,
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
            'santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '26011', 'is_active_lembaga' => 'Ya',
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'kelas_id' => $f['kelasMi']->id, 'no_absen' => 3, 'is_active_riwayat' => 'Ya',
        ]);
        $this->assertSame('Ya', $santri->fresh()->is_active_pst);
    }

    public function test_07_import_nis_lokal_tanpa_nik(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Impor NIS Lokal', '26012', $f['mi']);

        $csv = $this->makeCsv([[
            'nis_lokal' => '26012',
            'jenjang' => (string) $f['mi']->jenjang,
            'tahun_ajaran' => (string) $f['taMi']->nama,
            'semester' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
        ]]);
        $this->importCsv($admin, $csv)->assertStatus(200);

        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'is_active_riwayat' => 'Ya']);
    }

    // ---------- 08. import dry-run + kegagalan baris ----------

    public function test_08_import_periksa_dry_run_dan_gagal_baris(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Periksa Satu', '26020', $f['mi']);

        $csv = $this->makeCsv([
            // valid
            ['nis_lokal' => '26020', 'jenjang' => (string) $f['mi']->jenjang, 'tahun_ajaran' => (string) $f['taMi']->nama, 'semester' => '1'],
            // santri tidak ditemukan
            ['nis_lokal' => '26999', 'jenjang' => (string) $f['mi']->jenjang, 'tahun_ajaran' => (string) $f['taMi']->nama, 'semester' => '1'],
            // TA disembunyikan untuk lembaga ini
            ['nis_lokal' => '26020', 'jenjang' => (string) $f['mi']->jenjang, 'tahun_ajaran' => (string) $f['taLama']->nama, 'semester' => '1'],
            // kelas lintas lingkup
            ['nis_lokal' => '26020', 'jenjang' => (string) $f['mi']->jenjang, 'tahun_ajaran' => (string) $f['taMi']->nama, 'kelas_id' => 'MD-A', 'semester' => '1'],
        ]);

        $res = $this->actingAs($admin, 'sanctum')->post('/api/admin/riwayat-belajar/import-periksa', [
            'file' => new UploadedFile($csv, 'periksa.csv', 'text/csv', null, true),
        ])->assertStatus(200);

        $res->assertJsonPath('siap_import', false)
            ->assertJsonPath('ringkasan.baris_valid', 1)
            ->assertJsonPath('ringkasan.baris_gagal', 3);
        $this->assertSame(0, RiwayatBelajar::count());
    }

    // ---------- 09. no_absen ganda diloloskan (digenerate menyusul) ----------

    public function test_09_import_no_absen_ganda_tidak_divalidasi(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $a = $this->makeSantri('Absen A', '26022', $f['mi']);
        $b = $this->makeSantri('Absen B', '26023', $f['mi']);

        $csv = $this->makeCsv([
            ['nis_lokal' => '26022', 'jenjang' => (string) $f['mi']->jenjang, 'tahun_ajaran' => (string) $f['taMi']->nama, 'kelas_id' => '1A', 'semester' => '1', 'no_absen' => '1'],
            ['nis_lokal' => '26023', 'jenjang' => (string) $f['mi']->jenjang, 'tahun_ajaran' => (string) $f['taMi']->nama, 'kelas_id' => '1A', 'semester' => '1', 'no_absen' => '1'],
        ]);
        // Tanpa cek unik: dua-duanya dibuat (nomor digenerate ulang menyusul).
        $this->importCsv($admin, $csv)->assertStatus(200);

        $this->assertSame(2, RiwayatBelajar::count());
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $a->id)->count());
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $b->id)->count());
    }

    // ---------- 10. import memperbarui baris yang sudah ada ----------

    public function test_10_import_memperbarui_riwayat_existing(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Update Riwayat', '26024', $f['mi']);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['taMi']->nama, 'jenjang' => $f['mi']->jenjang,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        $csv = $this->makeCsv([[
            'nis_lokal' => '26024',
            'jenjang' => (string) $f['mi']->jenjang,
            'tahun_ajaran' => (string) $f['taMi']->nama,
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
        $santri = $this->makeSantri('Arsip Riwayat', '26025', $f['mi']);

        $csv = $this->makeCsv([[
            'nis_lokal' => '26025',
            'jenjang' => (string) $f['mi']->jenjang,
            'tahun_ajaran' => (string) $f['taMi']->nama,
            'semester' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'pindah_keluar',
        ]]);
        $this->importCsv($admin, $csv)->assertStatus(200);

        $riwayat = RiwayatBelajar::firstOrFail();
        $this->assertSame('pindah_keluar', $riwayat->status_akhir);
        $this->assertSame('Tidak', $riwayat->is_active_riwayat);
        $this->assertSame('Tidak', $santri->fresh()->is_active_pst);
    }

    public function test_12_tingkat_mewarisi_kelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();

        // Terima tanpa tingkat eksplisit → warisi kelas.tingkat.
        $s = $this->makeSantri('Waris Tingkat');
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama, 'kelas_id' => $f['kelasMi']->id,
        ])->assertStatus(201);
        $this->assertSame('1', $res->json('data.tingkat'));

        // Set kelas menyusul pada riwayat tanpa tingkat → warisi juga.
        $s2 = $this->makeSantri('Waris Susul');
        $r2 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $s2->id, 'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama,
        ])->assertStatus(201)->json('data');
        $this->assertNull($r2['tingkat']);
        $set = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/riwayat-belajar/{$r2['id']}/set-kelas", ['kelas_id' => $f['kelasMi']->id]
        )->assertStatus(200);
        $this->assertSame('1', $set->json('data.tingkat') ?? $set->json('tingkat'));

        // Tingkat eksplisit yang bentrok tetap ditolak (bukan ditimpa).
        $s3 = $this->makeSantri('Tolak Bentrok');
        $r3 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $s3->id, 'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama, 'tingkat' => '2',
        ])->assertStatus(201)->json('data');
        $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/riwayat-belajar/{$r3['id']}/set-kelas", ['kelas_id' => $f['kelasMi']->id]
        )->assertStatus(422);
    }

    public function test_13_urut_join_tidak_ambigu_dengan_filter_lembaga(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();

        // Skenario halaman Kenaikan: filter lembaga + semester + urut
        // (join santri/kelas/lembaga/tahun_ajaran) — 1052 bila tak terkualifikasi.
        $s = $this->makeSantri('Urut Aman');
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/riwayat-belajar', [
            'santri_id' => $s->id, 'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taMi']->nama, 'kelas_id' => $f['kelasMi']->id,
        ])->assertStatus(201);
        // Penerimaan selalu membuka semester 1; geser ke genap untuk skenario.
        RiwayatBelajar::whereKey($res->json('data.id'))->update(['semester' => '2']);

        $daftar = $this->actingAs($admin, 'sanctum')->getJson(
            '/api/admin/riwayat-belajar?jenjang='.$f['mi']->jenjang.'&semester=2&sort=santri&arah=naik'
        )->assertStatus(200);
        $this->assertCount(1, $daftar->json('data'));
        $this->assertStringStartsWith('Urut Aman', $daftar->json('data.0.santri.nama_lengkap'));
    }

    // ---------- 14. import update: sel kosong = pertahankan ----------

    public function test_14_import_update_hanya_sel_terisi(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Update Parsial', '26026', $f['mi']);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['taMi']->nama, 'jenjang' => $f['mi']->jenjang,
            'kelas_id' => $f['kelasMi']->id, 'semester' => '1', 'no_absen' => 3, 'tingkat' => '1',
            'status_awal' => 'santri_baru', 'status_akhir' => 'pindah_keluar', 'is_active_riwayat' => 'Tidak',
        ]);

        // Hanya tingkat yang diisi: status arsip + kelas + absen wajib bertahan.
        $csv = $this->makeCsv([[
            'nis_lokal' => '26026',
            'jenjang' => (string) $f['mi']->jenjang,
            'tahun_ajaran' => (string) $f['taMi']->nama,
            'semester' => '1',
            'tingkat' => '2',
        ]]);

        $periksa = $this->actingAs($admin, 'sanctum')->post('/api/admin/riwayat-belajar/import-periksa', [
            'file' => new UploadedFile($csv, 'periksa.csv', 'text/csv', null, true),
        ])->assertStatus(200);
        $this->assertTrue((bool) $periksa->json('siap_import'));
        $this->assertSame(0, (int) $periksa->json('ringkasan.dibuat'));
        $this->assertSame(1, (int) $periksa->json('ringkasan.diperbarui'));

        $this->importCsv($admin, $csv)->assertStatus(200);

        $this->assertSame(1, RiwayatBelajar::where('santri_id', $santri->id)->count());
        $riwayat = RiwayatBelajar::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame('2', $riwayat->tingkat);
        $this->assertSame($f['kelasMi']->id, (int) $riwayat->kelas_id);
        $this->assertSame(3, (int) $riwayat->no_absen);
        $this->assertSame('pindah_keluar', $riwayat->status_akhir);
        $this->assertSame('Tidak', $riwayat->is_active_riwayat);
    }

    // ---------- 15. import izin per baris mengikuti akun ----------

    public function test_15_import_barus_luar_lembaga_gagal_per_baris(): void
    {
        $f = $this->baseFixture();
        // MTS di luar pasangan MI↔MD: admin MI tak boleh menulisnya.
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);
        $a = $this->makeSantri('Riwayat MI', '26027', $f['mi']);
        $b = $this->makeSantri('Riwayat MTS', '26028', $mts);

        $csv = $this->makeCsv([
            ['nis_lokal' => '26027', 'jenjang' => (string) $f['mi']->jenjang, 'tahun_ajaran' => (string) $f['taMi']->nama, 'semester' => '1'],
            ['nis_lokal' => '26028', 'jenjang' => (string) $mts->jenjang, 'tahun_ajaran' => (string) $f['taMi']->nama, 'semester' => '1'],
        ]);
        $res = $this->actingAs($adminMi, 'sanctum')->post('/api/admin/riwayat-belajar/import-lengkap', [
            'file' => new UploadedFile($csv, 'riwayat.csv', 'text/csv', null, true),
        ])->assertStatus(422);

        $this->assertSame('jenjang', $res->json('errors.0.attribute'));
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $a->id)->count());
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $b->id)->count());
    }

    // ---------- 16. heading nama_kelas (kelas_id lama tetap jalan) ----------

    public function test_16_import_heading_nama_kelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $kelasB = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taMi']->nama,
            'nama_kelas' => '1B', 'tingkat' => '1',
        ]);
        $a = $this->makeSantri('Kelas Nama', '26031', $f['mi']);
        $b = $this->makeSantri('Kelas Id Lama', '26032', $f['mi']);

        $tulis = function (array $headers, array $rows): string {
            $tmp = tempnam(sys_get_temp_dir(), 'riwayat116').'.csv';
            $h = fopen($tmp, 'w');
            fputcsv($h, $headers);
            foreach ($rows as $r) {
                $line = [];
                foreach ($headers as $col) {
                    $line[] = $r[$col] ?? '';
                }
                fputcsv($h, $line);
            }
            fclose($h);

            return $tmp;
        };
        $kirim = fn (string $csv) => $this->actingAs($admin, 'sanctum')->post('/api/admin/riwayat-belajar/import-lengkap', [
            'file' => new UploadedFile($csv, 'riwayat.csv', 'text/csv', null, true),
        ]);

        $dasar = ['jenjang' => (string) $f['mi']->jenjang, 'tahun_ajaran' => (string) $f['taMi']->nama, 'semester' => '1'];
        $kepalaBaru = ['nis_lokal', 'jenjang', 'tahun_ajaran', 'nama_kelas', 'semester', 'tgl_masuk', 'no_absen', 'tingkat', 'status_awal', 'status_akhir'];

        // Insert via nama_kelas.
        $kirim($tulis($kepalaBaru, [
            ['nis_lokal' => '26031'] + $dasar + ['nama_kelas' => '1A'],
        ]))->assertStatus(200);
        $this->assertSame($f['kelasMi']->id, (int) RiwayatBelajar::where('santri_id', $a->id)->firstOrFail()->kelas_id);

        // Update via nama_kelas (pindah ke 1B).
        $kirim($tulis($kepalaBaru, [
            ['nis_lokal' => '26031'] + $dasar + ['nama_kelas' => '1B'],
        ]))->assertStatus(200);
        $this->assertSame($kelasB->id, (int) RiwayatBelajar::where('santri_id', $a->id)->firstOrFail()->kelas_id);
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $a->id)->count());

        // Heading lama kelas_id numerik tetap diterima.
        $kirim($tulis(self::HEADERS, [
            ['nis_lokal' => '26032'] + $dasar + ['kelas_id' => (string) $f['kelasMi']->id],
        ]))->assertStatus(200);
        $this->assertSame($f['kelasMi']->id, (int) RiwayatBelajar::where('santri_id', $b->id)->firstOrFail()->kelas_id);
    }

    // ---------- 17. status label Proper Case dipetakan ke kode ----------

    public function test_17_import_status_label_dipetakan_ke_kode(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $a = $this->makeSantri('Status Label', '26041', $f['mi']);
        $b = $this->makeSantri('Status Kode', '26042', $f['mi']);
        $c = $this->makeSantri('Status Asing', '26043', $f['mi']);
        $dasar = ['jenjang' => (string) $f['mi']->jenjang, 'tahun_ajaran' => (string) $f['taMi']->nama, 'semester' => '1'];

        // Label → tersimpan sebagai kode.
        $this->importCsv($admin, $this->makeCsv([
            ['nis_lokal' => '26041'] + $dasar + ['status_awal' => 'Pindahan', 'status_akhir' => 'Aktif'],
        ]))->assertStatus(200);
        $riwayat = RiwayatBelajar::where('santri_id', $a->id)->firstOrFail();
        $this->assertSame('pindahan', $riwayat->status_awal);
        $this->assertSame('aktif', $riwayat->status_akhir);

        // Kode lama tetap jalan.
        $this->importCsv($admin, $this->makeCsv([
            ['nis_lokal' => '26042'] + $dasar + ['status_awal' => 'santri_baru', 'status_akhir' => 'aktif'],
        ]))->assertStatus(200);
        $this->assertSame('santri_baru', RiwayatBelajar::where('santri_id', $b->id)->firstOrFail()->status_awal);

        // Label tak dikenal → gagal baris.
        $res = $this->importCsv($admin, $this->makeCsv([
            ['nis_lokal' => '26043'] + $dasar + ['status_awal' => 'Status Fiktif'],
        ]))->assertStatus(422);
        $this->assertSame('status_awal', $res->json('errors.0.attribute'));
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $c->id)->count());

        // Singkatan ekspor historis → kode.
        $d = $this->makeSantri('Status Singkat', '26044', $f['mi']);
        $this->importCsv($admin, $this->makeCsv([
            ['nis_lokal' => '26044'] + $dasar + ['status_awal' => 'Kenaikan', 'status_akhir' => 'Naik Kelas'],
        ]))->assertStatus(200);
        $riwayat = RiwayatBelajar::where('santri_id', $d->id)->firstOrFail();
        $this->assertSame('kenaikan', $riwayat->status_awal);
        $this->assertSame('naik', $riwayat->status_akhir);

        $e = $this->makeSantri('Status Keluar', '26045', $f['mi']);
        $this->importCsv($admin, $this->makeCsv([
            ['nis_lokal' => '26045'] + $dasar + ['status_akhir' => 'Keluar'],
        ]))->assertStatus(200);
        $this->assertSame('pindah_keluar', RiwayatBelajar::where('santri_id', $e->id)->firstOrFail()->status_akhir);
    }

    // ---------- 18-19. arsip keanggotaan sendiri ----------

    protected function nonaktifkanKeanggotaan(Santri $santri, Lembaga $lembaga): void
    {
        LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $lembaga->jenjang)
            ->update(['is_active_lembaga' => 'Tidak', 'tgl_selesai' => '2025-06-01']);
    }

    public function test_18_import_aktif_mengaktifkan_ulang_arsip_sendiri(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Arsip Aktif Lagi', '26051', $f['mi']);
        $this->nonaktifkanKeanggotaan($santri, $f['mi']);

        $this->importCsv($admin, $this->makeCsv([[
            'nis_lokal' => '26051',
            'jenjang' => (string) $f['mi']->jenjang,
            'tahun_ajaran' => (string) $f['taMi']->nama,
            'semester' => '1',
        ]]))->assertStatus(200);

        $anggota = LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $f['mi']->jenjang)->firstOrFail();
        $this->assertSame('Ya', $anggota->is_active_lembaga);
        $this->assertNull($anggota->tgl_selesai);
        $this->assertSame(1, LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $f['mi']->jenjang)->count());
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'is_active_riwayat' => 'Ya']);
    }

    public function test_19_import_arsip_tak_membangunkan_keanggotaan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Arsip Tetap', '26052', $f['mi']);
        $this->nonaktifkanKeanggotaan($santri, $f['mi']);

        $this->importCsv($admin, $this->makeCsv([[
            'nis_lokal' => '26052',
            'jenjang' => (string) $f['mi']->jenjang,
            'tahun_ajaran' => (string) $f['taMi']->nama,
            'semester' => '1',
            'status_akhir' => 'Pindah/Keluar',
        ]]))->assertStatus(200);

        $this->assertSame('Tidak', LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $f['mi']->jenjang)->firstOrFail()->is_active_lembaga);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'status_akhir' => 'pindah_keluar', 'is_active_riwayat' => 'Tidak']);
    }

    // ---------- 20. sel tanggal xlsx nyata (objek DateTime) ----------

    public function test_20_import_sel_tanggal_xlsx_nyata(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        $santri = $this->makeSantri('Tanggal Xlsx', '26061', $f['mi']);

        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->fromArray([['nis_lokal', 'jenjang', 'tahun_ajaran', 'semester', 'tgl_masuk']], null, 'A1');
        $sheet->setCellValue('A2', '26061');
        $sheet->setCellValue('B2', 'MI');
        $sheet->setCellValue('C2', '2026/2027');
        $sheet->setCellValue('D2', '1');
        $sheet->setCellValue('E2', new \DateTime('2026-07-01'));
        $sheet->getStyle('E2')->getNumberFormat()->setFormatCode('yyyy-mm-dd');
        // Serial mentah berformat General (kasus file historis).
        $sheet->setCellValue('A3', '26062');
        $sheet->setCellValue('B3', 'MI');
        $sheet->setCellValue('C3', '2026/2027');
        $sheet->setCellValue('D3', '1');
        $sheet->setCellValue('E3', 45123);
        $santri2 = $this->makeSantri('Tanggal Serial', '26062', $f['mi']);
        $tmp = tempnam(sys_get_temp_dir(), 'riwayat120').'.xlsx';
        (new Xlsx($spreadsheet))->save($tmp);
        $spreadsheet->disconnectWorksheets();

        $this->actingAs($admin, 'sanctum')->post('/api/admin/riwayat-belajar/import-lengkap', [
            'file' => new UploadedFile($tmp, 'riwayat.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true),
        ])->assertStatus(200);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'tgl_masuk' => '2026-07-01']);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri2->id,
            'tgl_masuk' => Date::excelToDateTimeObject(45123)->format('Y-m-d'),
        ]);
    }

    // ---------- 21. fallback pasangan MI↔MD ----------

    public function test_21_import_cocok_nis_pasangan_membuka_keanggotaan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        // Santri hanya dikenal di MI; baris MD dengan NIS sama membuka
        // keanggotaan MD otomatis.
        $santri = $this->makeSantri('Pasangan MD', '26071', $f['mi']);

        $this->importCsv($admin, $this->makeCsv([[
            'nis_lokal' => '26071',
            'jenjang' => (string) $f['md']->jenjang,
            'tahun_ajaran' => (string) $f['taMd']->nama,
            'semester' => '1',
        ]]))->assertStatus(200);

        $this->assertDatabaseHas('lembaga_santri', [
            'santri_id' => $santri->id, 'jenjang' => $f['md']->jenjang, 'nis_lokal' => '26071', 'is_active_lembaga' => 'Ya',
        ]);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'jenjang' => $f['md']->jenjang, 'is_active_riwayat' => 'Ya']);
    }

    // ---------- 22. cocok pasangan tak menimpa NIS target ----------

    public function test_22_import_pasangan_mempertahankan_nis_target(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser();
        // Santri dikenal di MI (26072) dan punya arsip MD bernis lain (26073):
        // baris MD bernis MI tidak boleh menimpa nis MD miliknya.
        $santri = $this->makeSantri('NIS Ganda', '26072', $f['mi']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => $f['md']->jenjang,
            'nis_lokal' => '26073', 'is_active_lembaga' => 'Tidak', 'tgl_masuk' => '2026-07-01',
        ]);

        $this->importCsv($admin, $this->makeCsv([[
            'nis_lokal' => '26072',
            'jenjang' => (string) $f['md']->jenjang,
            'tahun_ajaran' => (string) $f['taMd']->nama,
            'semester' => '1',
        ]]))->assertStatus(200);

        $anggota = LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $f['md']->jenjang)->firstOrFail();
        $this->assertSame('26073', $anggota->nis_lokal);
        $this->assertSame('Ya', $anggota->is_active_lembaga);
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $santri->id)->count());
    }
}
