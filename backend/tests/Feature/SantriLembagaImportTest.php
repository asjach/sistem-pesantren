<?php

namespace Tests\Feature;

use App\Exports\SantriLembagaDataExport;
use App\Exports\SantriLembagaTemplateExport;
use App\Imports\SantriLengkapImport;
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
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * Import gabungan siswa: satu file → `santri` + `lembaga_santri`.
 * Blok keanggotaan di awal kolom; file juga bisa dipakai update (round-trip).
 */
class SantriLembagaImportTest extends TestCase
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

        return compact('root', 'mi', 'md');
    }

    protected int $userSeq = 0;

    protected function makeAdmin(array $lembagaIds): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Admin '.$this->userSeq,
            'email' => "gabungan_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9200000000 + $this->userSeq * 97), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole('admin');
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function makeCsv(array $rows): string
    {
        $headers = [
            'santri_id', 'jenjang', 'nis_lokal', 'nis_kemenag',
            'is_active_lembaga', 'tgl_masuk', 'tgl_selesai',
            'tahaj_masuk', 'tingkat_masuk', 'no_urut',
            'nama_sekolah_asal', 'npsn_sekolah_asal', 'nss_sekolah_asal', 'alamat_sekolah_asal',
            'nama_lengkap', 'nik', 'jk', 'tgl_lahir', 'kepala_keluarga', 'ayah_nik',
        ];
        $tmp = tempnam(sys_get_temp_dir(), 'gabungan').'.csv';
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
    }

    protected function upload(User $admin, string $csvPath, string $endpoint = 'import-gabungan')
    {
        return $this->actingAs($admin, 'sanctum')->post("/api/admin/santri/{$endpoint}", [
            'file' => new UploadedFile($csvPath, 'gabungan.csv', 'text/csv', null, true),
        ]);
    }

    // ---------- 01. kolom: blok lembaga dulu ----------

    public function test_01_kolom_blok_lembaga_dulu(): void
    {
        $kolom = SantriLembagaTemplateExport::kolom();

        $this->assertSame(
            ['santri_id', 'jenjang', 'nis_lokal', 'nis_kemenag', 'is_active_lembaga', 'tgl_masuk', 'tgl_selesai'],
            array_slice($kolom, 0, 7),
        );
        foreach (Santri::KOLOM_PROFIL as $k) {
            $this->assertContains($k, $kolom);
        }
    }

    // ---------- 02. baris baru: santri + keanggotaan tercipta ----------

    public function test_02_baris_baru_buat_santri_dan_anggota(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $this->upload($admin, $this->makeCsv([[
            'jenjang' => 'mi', // case-insensitive
            'nis_lokal' => '26001',
            'is_active_lembaga' => 'Ya',
            'tgl_masuk' => '2026-07-01',
            'nama_lengkap' => 'Siswa Baru',
            'nik' => '1101010000000001',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
        ]]))->assertStatus(200);

        $santri = Santri::where('nik', '1101010000000001')->firstOrFail();
        $ls = LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $f['mi']->jenjang)->firstOrFail();
        $this->assertSame('26001', $ls->nis_lokal);
        $this->assertSame('Ya', $ls->is_active_lembaga);
        $this->assertSame('2026-07-01', $ls->tgl_masuk->format('Y-m-d'));
    }

    // ---------- 03. NIK cocok: profil + keanggotaan ter-update ----------

    public function test_03_nik_cocok_update_profil_dan_anggota(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $santri = Santri::create(['nama_lengkap' => 'Lama', 'nik' => '1101010000000002', 'jk' => 'L', 'tgl_lahir' => '2015-01-01']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25001', 'is_active_lembaga' => 'Ya']);

        $csv = $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '25002',
            'nama_lengkap' => 'Lama',
            'nik' => '1101010000000002',
            'jk' => 'L',
            'tgl_lahir' => '2015-01-01',
        ]]);

        $this->upload($admin, $csv)->assertStatus(200);

        $this->assertSame(1, Santri::where('nik', '1101010000000002')->count());
        $this->assertSame('25002', LembagaSantri::where('santri_id', $santri->id)->firstOrFail()->nis_lokal);

        // Mode periksa melaporkan baris update tanpa menulis ulang yang merusak.
        $res = $this->upload($admin, $csv, 'import-periksa-gabungan')->assertStatus(200);
        $this->assertTrue((bool) $res->json('siap_import'));
        $this->assertSame(1, (int) $res->json('ringkasan.baris_diperbarui'));
    }

    // ---------- 04. tanpa NIK: fallback NIS + lembaga ----------

    public function test_04_tanpa_nik_cocok_via_nis(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $santri = Santri::create(['nama_lengkap' => 'Tanpa NIK', 'jk' => 'P']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25009', 'is_active_lembaga' => 'Ya']);

        $this->upload($admin, $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '25009',
            'nama_lengkap' => 'Tanpa NIK',
            'jk' => 'P',
        ]]))->assertStatus(200);

        $this->assertSame(1, Santri::where('nama_lengkap', 'Tanpa NIK')->count());
    }

    // ---------- 05. santri_id eksak: baris parsial ----------

    public function test_05_santri_id_kunci_eksak_parsial(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $santri = Santri::create(['nama_lengkap' => 'Parsial', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25100', 'is_active_lembaga' => 'Ya']);

        $this->upload($admin, $this->makeCsv([[
            'santri_id' => (string) $santri->id,
            'jenjang' => 'MI',
            'nis_lokal' => '25101',
        ]]))->assertStatus(200);

        // Profil tidak terhapus oleh sel kosong; NIS ter-update.
        $this->assertSame('Parsial', $santri->fresh()->nama_lengkap);
        $this->assertSame('25101', LembagaSantri::where('santri_id', $santri->id)->firstOrFail()->nis_lokal);
    }

    // ---------- 06. dry-run tidak menulis ----------

    public function test_06_periksa_tidak_menulis(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $sebelumSantri = Santri::count();
        $sebelumLs = LembagaSantri::count();

        $res = $this->upload($admin, $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '25200',
            'nama_lengkap' => 'Calon Saja',
            'nik' => '1101010000000003',
            'jk' => 'L',
        ]]), 'import-periksa-gabungan')->assertStatus(200);

        $this->assertTrue((bool) $res->json('siap_import'));
        $this->assertSame($sebelumSantri, Santri::count());
        $this->assertSame($sebelumLs, LembagaSantri::count());
    }

    // ---------- 07. NIS dipakai santri lain → gagal baris ----------

    public function test_07_nis_ganda_gagal_baris(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $a = Santri::create(['nama_lengkap' => 'Pemilik NIS', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $a->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25300', 'is_active_lembaga' => 'Ya']);

        $res = $this->upload($admin, $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '25300',
            'nama_lengkap' => 'Penyerobot',
            'nik' => '1101010000000004',
            'jk' => 'L',
        ]]))->assertStatus(422);

        $attrs = collect($res->json('errors'))->pluck('attribute')->all();
        $this->assertContains('nis_lokal', $attrs);
        $this->assertNull(Santri::where('nik', '1101010000000004')->first()?->lembagaSantri()->first());
    }

    // ---------- 08. tenant: baris luar lingkup gagal, dalam lingkup masuk ----------

    public function test_08_baris_luar_lingkup_gagal(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeAdmin([$f['mi']->jenjang]);
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);

        $res = $this->upload($adminMi, $this->makeCsv([
            [
                'jenjang' => 'MI', 'nis_lokal' => '25401',
                'nama_lengkap' => 'Anak MI', 'nik' => '1101010000000005', 'jk' => 'L',
            ],
            [
                'jenjang' => 'MD', 'nis_lokal' => '25402',
                'nama_lengkap' => 'Anak MD', 'nik' => '1101010000000006', 'jk' => 'L',
            ],
            [
                'jenjang' => 'MTS', 'nis_lokal' => '25403',
                'nama_lengkap' => 'Anak MTS', 'nik' => '1101010000000007', 'jk' => 'L',
            ],
        ]))->assertStatus(422);

        $this->assertNotNull(Santri::where('nik', '1101010000000005')->first());
        $this->assertNotNull(Santri::where('nik', '1101010000000006')->first());
        $this->assertNull(Santri::where('nik', '1101010000000007')->first());
        $attrs = collect($res->json('errors'))->pluck('attribute')->all();
        $this->assertContains('jenjang', $attrs);
    }

    // ---------- 09. izin AND: tambah tanpa ubah → 403 ----------

    public function test_09_tambah_tanpa_ubah_ditolak(): void
    {
        $f = $this->baseFixture();
        $this->userSeq++;
        $u = User::create([
            'name' => 'Kritis '.$this->userSeq,
            'email' => "gabungan_kritis_{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9300000000 + $this->userSeq * 97), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->givePermissionTo(['santri.lihat', 'santri.tambah']);
        DB::table('user_lembaga')->insert([
            'user_id' => $u->id, 'jenjang' => $f['mi']->jenjang,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->upload($u, $this->makeCsv([[
            'jenjang' => 'MI', 'nis_lokal' => '25501',
            'nama_lengkap' => 'Tertolak', 'nik' => '1101010000000007', 'jk' => 'L',
        ]]))->assertStatus(403);
    }

    // ---------- 10. file identitas diterima: santri saja, tanpa anggota ----------

    public function test_10_baris_tanpa_jenjang_ditolak(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $tmp = tempnam(sys_get_temp_dir(), 'identitas').'.csv';
        $h = fopen($tmp, 'w');
        fputcsv($h, ['nama_lengkap', 'jk', 'nik']);
        fputcsv($h, ['Hanya Identitas', 'L', '1101010000000008']);
        fclose($h);

        // Keanggotaan wajib: baris tanpa jenjang gagal, tak ada santri dibuat.
        $res = $this->upload($admin, $tmp)->assertStatus(422);
        $attrs = collect($res->json('errors'))->pluck('attribute')->all();
        $this->assertContains('jenjang', $attrs);
        $this->assertNull(Santri::where('nik', '1101010000000008')->first());

        // Periksa menandai file belum siap import.
        $cek = $this->upload($admin, $tmp, 'import-periksa-gabungan')->assertStatus(200);
        $this->assertFalse((bool) $cek->json('siap_import'));
    }

    // ---------- 14. file campuran: dua lembaga berbeda ----------

    public function test_14_file_campuran_pasangan_tepat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang, $f['md']->jenjang]);

        $this->upload($admin, $this->makeCsv([
            [
                'jenjang' => 'MI', 'nis_lokal' => '26401',
                'nama_lengkap' => 'Campur MI', 'nik' => '1101010000000009', 'jk' => 'L',
            ],
            [
                'jenjang' => 'MD', 'nis_lokal' => '26402',
                'nama_lengkap' => 'Campur MD', 'nik' => '1101010000000010', 'jk' => 'P',
            ],
        ]))->assertStatus(200);

        $mi = Santri::where('nik', '1101010000000009')->firstOrFail();
        $md = Santri::where('nik', '1101010000000010')->firstOrFail();
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $mi->id, 'jenjang' => 'MI', 'nis_lokal' => '26401']);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $md->id, 'jenjang' => 'MD', 'nis_lokal' => '26402']);
    }

    // ---------- 11. template & data-gabungan bisa diunduh ----------

    public function test_11_unduh_template_dan_data(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $santri = Santri::create(['nama_lengkap' => 'Unduh Saya', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25601', 'is_active_lembaga' => 'Ya']);

        $this->actingAs($admin, 'sanctum')
            ->get('/api/admin/santri/import-template-gabungan')
            ->assertStatus(200);

        $this->actingAs($admin, 'sanctum')
            ->get('/api/admin/santri/data-gabungan?jenjang=MI')
            ->assertStatus(200)
            ->assertHeader('content-disposition', 'attachment; filename=data-siswa-MI.xlsx');

        // Isi pra-isi: santri_id + kode + nis di posisi blok lembaga.
        $isi = (new SantriLembagaDataExport([$f['mi']->jenjang]))->array();
        $this->assertCount(1, $isi);
        $this->assertSame((string) $santri->id, $isi[0][0]);
        $this->assertSame('MI', $isi[0][1]);
        $this->assertSame('25601', $isi[0][2]);
        $this->assertSame('Unduh Saya', $isi[0][14]);
    }

    // ---------- 13. unduh semua lingkup + round-trip campuran ----------

    public function test_13_data_semua_lingkup_dan_roundtrip(): void
    {
        $f = $this->baseFixture();
        $super = User::create([
            'name' => 'Super Unduh',
            'email' => 'super_unduh_'.uniqid().'@example.com',
            'phone' => '089000000001',
            'password' => 'password',
        ]);
        $super->assignRole('super_admin');
        $adminMi = $this->makeAdmin([$f['mi']->jenjang]);

        $a = Santri::create(['nama_lengkap' => 'Anak MI', 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $a->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '26101', 'is_active_lembaga' => 'Ya']);
        $b = Santri::create(['nama_lengkap' => 'Anak MD', 'jk' => 'P']);
        LembagaSantri::create(['santri_id' => $b->id, 'jenjang' => $f['md']->jenjang, 'nis_lokal' => '26201', 'is_active_lembaga' => 'Ya']);

        // Super admin tanpa parameter → semua operasional (MI + MD).
        $this->actingAs($super, 'sanctum')
            ->get('/api/admin/santri/data-gabungan')
            ->assertStatus(200)
            ->assertHeader('content-disposition', 'attachment; filename=data-siswa-pilihan.xlsx');
        $semua = (new SantriLembagaDataExport([$f['mi']->jenjang, $f['md']->jenjang]))->array();
        $this->assertCount(2, $semua);
        $this->assertSame(['MD', 'MI'], array_map(fn ($r) => $r[1], $semua));

        // Admin MI tanpa parameter → hanya MI (lingkup sendiri).
        $isi = (new SantriLembagaDataExport([$f['mi']->jenjang]))->array();
        $this->assertCount(1, $isi);

        // Round-trip campuran sebagai super admin: cocok keduanya via santri_id.
        $this->actingAs($super, 'sanctum')->post('/api/admin/santri/import-gabungan', [
            'file' => new UploadedFile($this->makeCsv([
                ['santri_id' => (string) $a->id, 'jenjang' => 'MI', 'nis_lokal' => '26102'],
                ['santri_id' => (string) $b->id, 'jenjang' => 'MD', 'nis_lokal' => '26202'],
            ]), 'campuran.csv', 'text/csv', null, true),
        ])->assertStatus(200);
        $this->assertSame('26102', LembagaSantri::where('santri_id', $a->id)->firstOrFail()->nis_lokal);
        $this->assertSame('26202', LembagaSantri::where('santri_id', $b->id)->firstOrFail()->nis_lokal);

        // Multi ID eksplisit → hanya yang dipilih; id luar lingkup → 422.
        $isi = (new SantriLembagaDataExport([$f['md']->jenjang]))->array();
        $this->assertCount(1, $isi);
        $this->assertSame('MD', $isi[0][1]);
        $this->actingAs($super, 'sanctum')
            ->get("/api/admin/santri/data-gabungan?jenjang[]={$f['mi']->jenjang}&jenjang[]={$f['md']->jenjang}")
            ->assertStatus(200);
        $this->actingAs($adminMi, 'sanctum')
            ->get("/api/admin/santri/data-gabungan?jenjang[]={$f['mi']->jenjang}&jenjang[]={$f['md']->jenjang}")
            ->assertStatus(200);
    }

    // ---------- 12. file ketikan manual: sel numerik + tanggal serial ----------

    public function test_12_xlsx_manual_sel_numerik_lolos(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        // Tiru file ketikan manual: NISN & NIS sebagai ANGKA, tanggal sebagai serial.
        $sheet = (new Spreadsheet)->getActiveSheet();
        $judul = [
            'santri_id', 'jenjang', 'nis_lokal', 'nis_kemenag',
            'is_active_lembaga', 'tgl_masuk', 'tgl_selesai', 'nama_lengkap', 'nik', 'jk',
            'tgl_lahir', 'nisn', 'rt',
        ];
        foreach ($judul as $c => $nama) {
            $sheet->setCellValue([$c + 1, 1], $nama);
        }
        $sheet->setCellValue([2, 2], 'MI');
        $sheet->setCellValue([3, 2], 26001); // numerik, bukan teks
        $sheet->setCellValue([8, 2], 'Manual Angka');
        $sheet->setCellValue([9, 2], '1101010000000009');
        $sheet->setCellValue([10, 2], 'L');
        $sheet->setCellValue([11, 2], Date::dateTimeToExcel(new \DateTimeImmutable('2015-07-01')));
        $sheet->setCellValue([12, 2], 1234567890); // NISN numerik
        $sheet->setCellValue([13, 2], 7); // RT numerik
        $path = tempnam(sys_get_temp_dir(), 'manual').'.xlsx';
        (new Xlsx($sheet->getParent()))->save($path);

        $res = $this->actingAs($admin, 'sanctum')->post('/api/admin/santri/import-periksa-gabungan', [
            'file' => new UploadedFile($path, 'manual.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true),
        ])->assertStatus(200);

        $this->assertTrue((bool) $res->json('siap_import'), json_encode($res->json('errors')));
        $this->assertSame(0, Santri::count()); // dry-run tidak menulis

        // Unit map(): cast angka → string, serial → Y-m-d.
        $import = new SantriLengkapImport;
        $dipetakan = $import->map(['nisn' => 1234567890, 'rt' => 7, 'tgl_lahir' => 42186, 'nama_lengkap' => 'X']);
        $this->assertSame('1234567890', $dipetakan['nisn']);
        $this->assertSame('7', $dipetakan['rt']);
        $this->assertSame('2015-07-01', $dipetakan['tgl_lahir']);
    }

    public function test_21_import_field_masuk_sekolah_asal_dan_kepala_keluarga(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);
        TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        $this->upload($admin, $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '27101',
            'is_active_lembaga' => 'Ya',
            'tgl_masuk' => '2026-07-01',
            'tahaj_masuk' => '2026/2027',
            'tingkat_masuk' => '1',
            'no_urut' => '7',
            'nama_sekolah_asal' => 'SD Negeri 1',
            'npsn_sekolah_asal' => '20512345',
            'nss_sekolah_asal' => '101010101010',
            'alamat_sekolah_asal' => 'Jl. Asal No. 1',
            'nama_lengkap' => 'Impor Field',
            'nik' => '1101010000000021',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
            'kepala_keluarga' => 'Bapak Kepala',
        ]]))->assertStatus(200);

        $santri = Santri::where('nik', '1101010000000021')->firstOrFail();
        $this->assertSame('Bapak Kepala', $santri->kepala_keluarga);

        $ls = LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $f['mi']->jenjang)->firstOrFail();
        $this->assertSame('2026/2027', $ls->tahaj_masuk);
        $this->assertSame('1', $ls->tingkat_masuk);
        $this->assertSame('7', (string) $ls->no_urut);
        $this->assertSame('SD Negeri 1', $ls->nama_sekolah_asal);
        $this->assertSame('20512345', $ls->npsn_sekolah_asal);
        $this->assertSame('101010101010', $ls->nss_sekolah_asal);
        $this->assertSame('Jl. Asal No. 1', $ls->alamat_sekolah_asal);
        $this->assertSame('2026-07-01', $ls->tgl_masuk?->format('Y-m-d'));
        // tahaj_masuk valid + keanggotaan aktif → riwayat perdana ikut dibuat.
        $this->assertTrue(RiwayatBelajar::where('santri_id', $santri->id)->where('jenjang', $f['mi']->jenjang)->exists());
    }

    // ---------- 22. tahaj_masuk + tingkat_masuk → riwayat belajar perdana ----------

    public function test_22_import_buat_riwayat_belajar_perdana(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);
        TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        $csv = $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '27201',
            'is_active_lembaga' => 'Ya',
            'tgl_masuk' => '2026-07-15',
            'tahaj_masuk' => '2026/2027',
            'tingkat_masuk' => '1',
            'nama_lengkap' => 'Riwayat Baru',
            'nik' => '1101010000000022',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
        ]]);

        // Mode periksa melaporkan rencana riwayat tanpa menulis.
        $periksa = $this->upload($admin, $csv, 'import-periksa-gabungan')->assertStatus(200);
        $this->assertTrue((bool) $periksa->json('siap_import'));
        $this->assertSame(1, (int) $periksa->json('ringkasan.baris_riwayat_dibuat'));
        $this->assertSame(0, RiwayatBelajar::count());

        $this->upload($admin, $csv)->assertStatus(200);

        $santri = Santri::where('nik', '1101010000000022')->firstOrFail();
        $riwayat = RiwayatBelajar::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame('2026/2027', $riwayat->tahun_ajaran);
        $this->assertSame($f['mi']->jenjang, $riwayat->jenjang);
        $this->assertSame('1', $riwayat->semester);
        $this->assertSame('1', $riwayat->tingkat);
        $this->assertSame('santri_baru', $riwayat->status_awal);
        $this->assertSame('aktif', $riwayat->status_akhir);
        $this->assertSame(RiwayatBelajar::YA, $riwayat->is_active_riwayat);
        $this->assertSame('2026-07-15', $riwayat->tgl_masuk?->format('Y-m-d'));
        $this->assertSame('Ya', $santri->fresh()->is_active_pst);
    }

    // ---------- 23. re-import idempoten: riwayat tidak digandakan ----------

    public function test_23_reimport_tidak_duplikat_riwayat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);
        TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        $csv = $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '27301',
            'is_active_lembaga' => 'Ya',
            'tgl_masuk' => '2026-07-01',
            'tahaj_masuk' => '2026/2027',
            'tingkat_masuk' => '1',
            'nama_lengkap' => 'Riwayat Sekali',
            'nik' => '1101010000000023',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
        ]]);

        $this->upload($admin, $csv)->assertStatus(200);
        $santri = Santri::where('nik', '1101010000000023')->firstOrFail();
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $santri->id)->count());

        // Import ulang: santri cocok, keanggotaan diperbarui, riwayat aktif dilewati.
        $res = $this->upload($admin, $csv, 'import-periksa-gabungan')->assertStatus(200);
        $this->assertSame(0, (int) $res->json('ringkasan.baris_riwayat_dibuat'));
        $this->upload($admin, $csv)->assertStatus(200);
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $santri->id)->count());
    }

    // ---------- 24. tahaj_masuk tak dikenal → baris ditolak (tanpa tulis) ----------

    public function test_24_tahaj_masuk_tak_dikenal_ditolak(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $res = $this->upload($admin, $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '27401',
            'is_active_lembaga' => 'Ya',
            'tahaj_masuk' => '1999/2000',
            'tingkat_masuk' => '1',
            'nama_lengkap' => 'TA Salah',
            'nik' => '1101010000000024',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
        ]]))->assertStatus(422);

        $this->assertSame('tahaj_masuk', $res->json('errors.0.attribute'));
        // Ditolak sebelum menulis: tak ada santri/keanggotaan yang terbentuk.
        $this->assertFalse(Santri::where('nik', '1101010000000024')->exists());
    }

    // ---------- 25. riwayat lama (arsip) di TA sama → tidak error & tidak duplikat ----------

    public function test_25_riwayat_arsip_ta_sama_tidak_diduplikasi(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);
        TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        $santri = Santri::create(['nama_lengkap' => 'Arsip Lama', 'nik' => '1101010000000025', 'jk' => 'L', 'tgl_lahir' => '2015-07-01']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '27501', 'is_active_lembaga' => 'Ya']);
        // Riwayat perdana lama sudah diarsipkan (mis. pernah keluar lalu masuk lagi).
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => '2026/2027', 'jenjang' => $f['mi']->jenjang,
            'semester' => '1', 'tingkat' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'pindah_keluar',
            'is_active_riwayat' => RiwayatBelajar::TIDAK,
        ]);

        $this->upload($admin, $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '27501',
            'is_active_lembaga' => 'Ya',
            'tgl_masuk' => '2026-07-01',
            'tahaj_masuk' => '2026/2027',
            'tingkat_masuk' => '1',
            'nama_lengkap' => 'Arsip Lama',
            'nik' => '1101010000000025',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
        ]]))->assertStatus(200);

        // Tidak menambah baris riwayat (unique santri+TA+jenjang+semester dijaga).
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $santri->id)->count());
    }

    // ---------- 26. file > 1 chunk: nomor baris kegagalan tetap global ----------

    public function test_26_chunk_besar_nomor_baris_global(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $rows = [];
        for ($i = 1; $i <= 599; $i++) {
            $rows[] = [
                'jenjang' => 'MI',
                'nis_lokal' => '28'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'nama_lengkap' => "Chunk {$i}",
                'nik' => '110188'.str_pad((string) $i, 10, '0', STR_PAD_LEFT),
                'jk' => 'L',
            ];
        }
        // Baris file ke-600 (chunk kedua): TA tak dikenal → gagal bernomor global.
        $rows[] = [
            'jenjang' => 'MI',
            'nis_lokal' => '28600',
            'tahaj_masuk' => '1999/2000',
            'nama_lengkap' => 'Chunk Rusak',
            'nik' => '110188'.str_pad('600', 10, '0', STR_PAD_LEFT),
            'jk' => 'L',
        ];

        $res = $this->upload($admin, $this->makeCsv($rows), 'import-periksa-gabungan')->assertStatus(200);
        $this->assertFalse((bool) $res->json('siap_import'));
        $this->assertSame(600, (int) $res->json('ringkasan.baris_diproses'));
        $this->assertSame(599, (int) $res->json('ringkasan.baris_valid'));
        // Penomoran Excel-absolut (baris 1 = heading): baris data ke-600 = 601.
        $this->assertSame(601, (int) $res->json('errors.0.row'));
        $this->assertSame('tahaj_masuk', $res->json('errors.0.attribute'));
        // Dry-run: tak ada yang tertulis.
        $this->assertSame(0, Santri::count());
        $this->assertSame(0, RiwayatBelajar::count());
    }

    // ---------- 27. normalisasi data nyata: strip TA, tanggal nol, NIK ortu ----------

    public function test_27_normalisasi_strip_tanggal_nol_dan_nik_ortu(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);
        TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        // Baris 1: tahaj strip + tanggal nol → diterima (riwayat TA kanonis, tgl null).
        // Baris 2: ayah_nik 17 digit → diterima + berflag `X-` (bukan gagal).
        // Baris 3: ayah_nik 21 digit → gagal per baris (melebihi maks 20).
        $res = $this->upload($admin, $this->makeCsv([
            [
                'jenjang' => 'MI',
                'nis_lokal' => '27701',
                'is_active_lembaga' => 'Ya',
                'tgl_masuk' => '2026-07-01',
                'tgl_selesai' => '1900-01-00',
                'tahaj_masuk' => '2026-2027',
                'tingkat_masuk' => '1',
                'nama_lengkap' => 'Normalisasi Satu',
                'nik' => '1101010000000027',
                'jk' => 'L',
                'tgl_lahir' => '2015-07-01',
            ],
            [
                'jenjang' => 'MI',
                'nis_lokal' => '27702',
                'nama_lengkap' => 'Nik Ortu Panjang',
                'nik' => '1101010000000028',
                'jk' => 'P',
                'tgl_lahir' => '2015-07-01',
                'ayah_nik' => '32041001010100001',
            ],
            [
                'jenjang' => 'MI',
                'nis_lokal' => '27703',
                'nama_lengkap' => 'Nik Ortu Kebablasan',
                'nik' => '1101010000000029',
                'jk' => 'P',
                'tgl_lahir' => '2015-07-01',
                'ayah_nik' => '320410010101000012345',
            ],
        ]), 'import-periksa-gabungan')->assertStatus(200);

        $this->assertFalse((bool) $res->json('siap_import'));
        $this->assertSame(3, (int) $res->json('ringkasan.baris_diproses'));
        $this->assertSame(2, (int) $res->json('ringkasan.baris_valid'));
        // Selaras validator: baris data ke-3 = baris Excel 4.
        $this->assertSame(4, (int) $res->json('errors.0.row'));
        $this->assertSame('ayah_nik', $res->json('errors.0.attribute'));

        // Dua baris valid dieksekusi dengan hasil ternormalisasi + berflag.
        $this->upload($admin, $this->makeCsv([
            [
                'jenjang' => 'MI',
                'nis_lokal' => '27701',
                'is_active_lembaga' => 'Ya',
                'tgl_masuk' => '2026-07-01',
                'tgl_selesai' => '1900-01-00',
                'tahaj_masuk' => '2026-2027',
                'tingkat_masuk' => '1',
                'nama_lengkap' => 'Normalisasi Satu',
                'nik' => '1101010000000027',
                'jk' => 'L',
                'tgl_lahir' => '2015-07-01',
            ],
            [
                'jenjang' => 'MI',
                'nis_lokal' => '27702',
                'nama_lengkap' => 'Nik Ortu Panjang',
                'nik' => '1101010000000028',
                'jk' => 'P',
                'tgl_lahir' => '2015-07-01',
                'ayah_nik' => '32041001010100001',
            ],
        ]))->assertStatus(200);

        $santri = Santri::where('nik', '1101010000000027')->firstOrFail();
        $ls = LembagaSantri::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame('2026/2027', $ls->tahaj_masuk);
        $this->assertNull($ls->tgl_selesai);
        $riwayat = RiwayatBelajar::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame('2026/2027', $riwayat->tahun_ajaran);

        $ortu = Santri::where('nik', '1101010000000028')->firstOrFail();
        $this->assertSame('X-32041001010100001', $ortu->ayah_nik);
    }

    // ---------- 28. NIK tak valid: tersimpan berflag + re-import tak ganda ----------

    public function test_28_nik_tak_valid_flag_dan_tidak_ganda(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $csv = $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '27801',
            'is_active_lembaga' => 'Ya',
            'nama_lengkap' => 'Nik Pendek',
            'nik' => '320410460905001',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
        ]]);

        $this->upload($admin, $csv)->assertStatus(200);
        $this->assertSame(1, Santri::where('nama_lengkap', 'Nik Pendek')->count());
        $santri = Santri::where('nama_lengkap', 'Nik Pendek')->firstOrFail();
        $this->assertSame('X-320410460905001', $santri->nik);

        // Import ulang file yang sama: cocok via NIK berflag, tak ada santri baru.
        $res = $this->upload($admin, $csv, 'import-periksa-gabungan')->assertStatus(200);
        $this->assertTrue((bool) $res->json('siap_import'));
        $this->assertSame(1, (int) $res->json('ringkasan.baris_diperbarui'));
        $this->upload($admin, $csv)->assertStatus(200);
        $this->assertSame(1, Santri::where('nama_lengkap', 'Nik Pendek')->count());
        $this->assertSame('X-320410460905001', Santri::where('nama_lengkap', 'Nik Pendek')->firstOrFail()->nik);
    }

    // ---------- 29. NIS Kemenag boleh duplikat ----------

    public function test_29_nis_kemenag_duplikat_diterima(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);

        $this->upload($admin, $this->makeCsv([
            [
                'jenjang' => 'MI',
                'nis_lokal' => '27901',
                'nis_kemenag' => '123456789012279001',
                'nama_lengkap' => 'Kemenag Satu',
                'nik' => '1101010000000031',
                'jk' => 'L',
            ],
            [
                'jenjang' => 'MI',
                'nis_lokal' => '27902',
                'nis_kemenag' => '123456789012279001',
                'nama_lengkap' => 'Kemenag Dua',
                'nik' => '1101010000000032',
                'jk' => 'P',
            ],
        ]))->assertStatus(200);

        $this->assertSame(
            '123456789012279001',
            LembagaSantri::whereHas('santri', fn ($q) => $q->where('nama_lengkap', 'Kemenag Satu'))->firstOrFail()->nis_kemenag
        );
        $this->assertSame(
            '123456789012279001',
            LembagaSantri::whereHas('santri', fn ($q) => $q->where('nama_lengkap', 'Kemenag Dua'))->firstOrFail()->nis_kemenag
        );
    }

    // ---------- 30. MD: nis_kemenag diabaikan (null) ----------

    public function test_30_md_nis_kemenag_diabaikan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang, $f['md']->jenjang]);

        $this->upload($admin, $this->makeCsv([[
            'jenjang' => 'MD',
            'nis_lokal' => '28001',
            'nis_kemenag' => '123456789012280001',
            'nama_lengkap' => 'MD Tanpa Kemenag',
            'nik' => '1101010000000033',
            'jk' => 'L',
        ]]))->assertStatus(200);

        $ls = LembagaSantri::where('jenjang', $f['md']->jenjang)->firstOrFail();
        $this->assertSame('28001', $ls->nis_lokal);
        $this->assertNull($ls->nis_kemenag);
    }

    // ---------- 31. keanggotaan nonaktif + tahaj_masuk → riwayat tetap dibuat ----------

    public function test_31_riwayat_dibuat_untuk_keanggotaan_nonaktif(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);
        TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        // Santri lama yang keanggotaannya nonaktif dan belum punya riwayat.
        $santri = Santri::create(['nama_lengkap' => 'Nonaktif Lama', 'nik' => '1101010000000034', 'jk' => 'L', 'tgl_lahir' => '2015-07-01']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '28101', 'is_active_lembaga' => 'Tidak']);

        $csv = $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '28101',
            // Tanpa penanda nonaktif: keanggotaan diaktifkan ulang + riwayat dibuat.
            'tahaj_masuk' => '2026/2027',
            'tingkat_masuk' => '1',
            'nama_lengkap' => 'Nonaktif Lama',
            'nik' => '1101010000000034',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
        ]]);

        // Mode periksa melaporkan rencana riwayat tanpa menulis.
        $periksa = $this->upload($admin, $csv, 'import-periksa-gabungan')->assertStatus(200);
        $this->assertSame(1, (int) $periksa->json('ringkasan.baris_riwayat_dibuat'));

        $this->upload($admin, $csv)->assertStatus(200);

        $riwayat = RiwayatBelajar::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame(RiwayatBelajar::YA, $riwayat->is_active_riwayat);
        $this->assertSame('Ya', LembagaSantri::aktif($santri->id, $f['mi']->jenjang)?->is_active_lembaga);
        $this->assertSame('Ya', $santri->fresh()->is_active_pst);
    }

    // ---------- 32. baris eksplisit nonaktif → riwayat tidak dibuat ----------

    public function test_32_baris_eksplisit_nonaktif_tanpa_riwayat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeAdmin([$f['mi']->jenjang]);
        TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        $csv = $this->makeCsv([[
            'jenjang' => 'MI',
            'nis_lokal' => '28102',
            'is_active_lembaga' => 'Tidak',
            'tahaj_masuk' => '2026/2027',
            'tingkat_masuk' => '1',
            'nama_lengkap' => 'Tetap Nonaktif',
            'nik' => '1101010000000035',
            'jk' => 'L',
            'tgl_lahir' => '2015-07-01',
        ]]);

        // Mode periksa: tidak ada rencana riwayat untuk baris eksplisit nonaktif.
        $periksa = $this->upload($admin, $csv, 'import-periksa-gabungan')->assertStatus(200);
        $this->assertSame(0, (int) $periksa->json('ringkasan.baris_riwayat_dibuat'));

        $this->upload($admin, $csv)->assertStatus(200);

        $santri = Santri::where('nik', '1101010000000035')->firstOrFail();
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $santri->id)->count());
        $this->assertSame('Tidak', LembagaSantri::where('santri_id', $santri->id)->where('jenjang', $f['mi']->jenjang)->value('is_active_lembaga'));
    }
}
