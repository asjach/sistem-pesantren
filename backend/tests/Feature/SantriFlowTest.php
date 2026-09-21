<?php

namespace Tests\Feature;

use App\Exports\SantriTemplateExport;
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
 * Buku induk santri (identitas murni) + keanggotaan per lembaga + NIS Kemenag.
 * Riwayat akademik diuji terpisah di RiwayatBelajarFlowTest.
 */
class SantriFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

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

        return compact('root', 'mi', 'md');
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->userSeq,
            'email' => "santri101_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9100000000 + $this->userSeq * 97 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
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

    protected function makeSantri(string $nama, array $opt = []): Santri
    {
        $this->santriSeq++;

        return Santri::create(array_merge([
            'nama_lengkap' => $nama.' '.$this->santriSeq,
            'jk' => 'L',
        ], $opt));
    }

    protected function makeCsv(array $rows): string
    {
        $headers = ['nama_lengkap', 'jk', 'nik', 'nisn', 'tgl_lahir', 'hobi', 'kewarganegaraan'];
        $tmp = tempnam(sys_get_temp_dir(), 'santri101').'.csv';
        $h = fopen($tmp, 'w');
        fputcsv($h, $headers);
        foreach ($rows as $r) {
            $line = [];
            foreach ($headers as $col) {
                $line[] = $r[$col] ?? ($col === 'kewarganegaraan' ? 'WNI' : '');
            }
            fputcsv($h, $line);
        }
        fclose($h);

        return $tmp;
    }

    protected function importCsv(User $admin, string $csvPath)
    {
        return $this->actingAs($admin, 'sanctum')->post('/api/admin/santri/import-lengkap', [
            'file' => new UploadedFile($csvPath, 'santri.csv', 'text/csv', null, true),
        ]);
    }

    // ---------- 01. index terskop tenant ----------

    public function test_01_index_terskop_tenant(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $santriMi = $this->makeSantri('Santri MI');
        LembagaSantri::create(['santri_id' => $santriMi->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25001', 'is_active_lembaga' => 'Ya']);
        $santriMd = $this->makeSantri('Santri MD');
        LembagaSantri::create(['santri_id' => $santriMd->id, 'lembaga_id' => $f['md']->id, 'nis_lokal' => '26001', 'is_active_lembaga' => 'Ya']);
        $tanpaKeanggotaan = $this->makeSantri('Belum Diterima');

        $res = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/santri')->assertStatus(200);
        $nama = collect($res->json('data'))->pluck('nama_lengkap')->all();

        $this->assertContains($santriMi->nama_lengkap, $nama);
        $this->assertContains($tanpaKeanggotaan->nama_lengkap, $nama);
        $this->assertContains($santriMd->nama_lengkap, $nama);
    }

    public function test_02_guru_akses_index_ditolak(): void
    {
        $this->baseFixture();
        $guru = $this->makeUser('guru', []);

        $this->actingAs($guru, 'sanctum')->getJson('/api/admin/santri')->assertStatus(403);
    }

    // ---------- 03. store manual identitas ----------

    public function test_03_store_manual_identitas_tanpa_relasi(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/santri', [
            'nama_lengkap' => 'Manual Satu',
            'jk' => 'P',
            'nik' => '1101010000000001',
            'nisn' => '1234567890',
        ])->assertStatus(201);

        $id = $res->json('data.id');
        $santri = Santri::findOrFail($id);
        $this->assertSame('Manual Satu', $santri->nama_lengkap);
        $this->assertSame('Tidak', $santri->is_active_pst);
        $this->assertSame(0, LembagaSantri::where('santri_id', $id)->count());
        // Tidak ada kolom relasional di payload master.
        $this->assertArrayNotHasKey('lembaga_id', $santri->getAttributes());
        $this->assertArrayNotHasKey('nis', $santri->getAttributes());
    }

    // ---------- 04. update identitas + validasi ----------

    public function test_04_update_identitas_dan_validasi(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $santri = $this->makeSantri('Edit Satu');

        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/santri/{$santri->id}", [
            'nik' => '123',
        ])->assertStatus(422)->assertJsonValidationErrors(['nik']);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/santri/{$santri->id}", [
            'nama_singkat' => 'Edit',
            'nisn' => '0987654321',
        ])->assertStatus(200)->assertJsonPath('data.nama_singkat', 'Edit');

        $this->assertSame('0987654321', $santri->fresh()->nisn);
    }

    // ---------- 05-08. import identitas ----------

    public function test_05_import_identitas_sukses_tanpa_riwayat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $csv = $this->makeCsv([
            ['nama_lengkap' => 'Impor Satu', 'jk' => 'L', 'nik' => '1101010000000011'],
            ['nama_lengkap' => 'Impor Dua', 'jk' => 'P', 'nik' => '1101010000000012'],
        ]);
        $this->importCsv($admin, $csv)->assertStatus(200);

        $this->assertSame(2, Santri::count());
        $this->assertSame(0, RiwayatBelajar::count());
        $this->assertSame(0, LembagaSantri::count());
        $this->assertSame('Tidak', Santri::where('nama_lengkap', 'Impor Satu')->firstOrFail()->is_active_pst);
    }

    public function test_06_import_nik_sama_update_bukan_ganda(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $this->importCsv($admin, $this->makeCsv([
            ['nama_lengkap' => 'Impor Tiga', 'jk' => 'L', 'nik' => '1101010000000013', 'hobi' => 'Membaca'],
        ]))->assertStatus(200);

        $this->importCsv($admin, $this->makeCsv([
            ['nama_lengkap' => 'Impor Tiga', 'jk' => 'L', 'nik' => '1101010000000013', 'hobi' => 'Menulis'],
        ]))->assertStatus(200);

        $this->assertSame(1, Santri::count());
        $this->assertSame('Menulis', Santri::firstOrFail()->hobi);
    }

    public function test_07_import_nik_kosong_tidak_saling_menimpa(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $this->importCsv($admin, $this->makeCsv([
            ['nama_lengkap' => 'Tanpa NIK Satu', 'jk' => 'L'],
            ['nama_lengkap' => 'Tanpa NIK Dua', 'jk' => 'P'],
        ]))->assertStatus(200);

        $this->assertSame(2, Santri::count());
    }

    public function test_08_import_periksa_dry_run_tanpa_menulis(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $csv = $this->makeCsv([
            ['nama_lengkap' => 'Valid Satu', 'jk' => 'L'],
            ['nama_lengkap' => 'JK Salah', 'jk' => 'X'],
        ]);
        $res = $this->actingAs($admin, 'sanctum')->post('/api/admin/santri/import-periksa', [
            'file' => new UploadedFile($csv, 'periksa.csv', 'text/csv', null, true),
        ])->assertStatus(200);

        $res->assertJsonPath('siap_import', false)
            ->assertJsonPath('ringkasan.baris_valid', 1)
            ->assertJsonPath('ringkasan.baris_gagal', 1);
        $this->assertSame(0, Santri::count());
    }

    // ---------- 09. template identitas ----------

    public function test_09_template_identitas_selaras_import(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $export = new SantriTemplateExport;
        $headings = $export->headings();
        $this->assertSame(Santri::KOLOM_PROFIL, $headings);
        $this->assertNotContains('lembaga_id', $headings);
        $this->assertNotContains('kelas_id', $headings);
        $this->assertNotContains('nis', $headings);
        $this->assertSame(count($headings), count($export->array()[0]));

        $this->actingAs($admin, 'sanctum')->get('/api/admin/santri/import-template')->assertStatus(200);
    }

    // ---------- 10-11. keanggotaan ----------

    public function test_10_keanggotaan_nis_lokal_unik_per_lembaga_dan_multi_lembaga(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Anggota Satu');

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lembaga", [
            'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25010', 'tgl_masuk' => '2026-07-01',
        ])->assertStatus(201);

        // NIS lokal sama di lembaga yang sama → 422.
        $lain = $this->makeSantri('Anggota Dua');
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$lain->id}/lembaga", [
            'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25010',
        ])->assertStatus(422);

        // NIS lokal sama di lembaga BERBEDA → boleh (multi-lembaga paralel).
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$lain->id}/lembaga", [
            'lembaga_id' => $f['md']->id, 'nis_lokal' => '25010',
        ])->assertStatus(201);

        // Bergabung juga ke MI dengan NIS lokal berbeda → dua keanggotaan aktif.
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$lain->id}/lembaga", [
            'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25011',
        ])->assertStatus(201);

        $this->assertSame(2, LembagaSantri::where('santri_id', $lain->id)->where('is_active_lembaga', 'Ya')->count());
    }

    public function test_11_keanggotaan_update_status_dan_tanggal(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Anggota Tiga');
        $ls = LembagaSantri::create([
            'santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '25011', 'is_active_lembaga' => 'Ya',
        ]);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$ls->id}", [
            'nis_lokal' => '25012', 'is_active_lembaga' => 'Tidak', 'tgl_selesai' => '2026-06-30',
        ])->assertStatus(200);

        $ls->refresh();
        $this->assertSame('25012', $ls->nis_lokal);
        $this->assertSame('Tidak', $ls->is_active_lembaga);
        $this->assertSame('2026-06-30', $ls->tgl_selesai?->format('Y-m-d'));
    }

    // ---------- 12-13. NIS Kemenag ----------

    public function test_12_generate_nisk_formula_dan_bentrok(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Nisk Satu');
        $ls = LembagaSantri::create([
            'santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '26001', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);
        $taMi = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $taMi->nama, 'lembaga_id' => $f['mi']->id,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        $res = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/lembaga-santri/{$ls->id}/generate-nisk")
            ->assertStatus(201);
        // 12 digit NSM + '26' + 4 digit akhir nis_lokal.
        $this->assertSame('123456789012'.'26'.'6001', $res->json('data.nis_kemenag'));

        // Santri lain dengan 4 digit akhir sama di tahun yang sama → bentrok 422.
        $lain = $this->makeSantri('Nisk Dua');
        $lsLain = LembagaSantri::create([
            'santri_id' => $lain->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '36001', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $lain->id, 'tahun_ajaran' => $taMi->nama, 'lembaga_id' => $f['mi']->id,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/lembaga-santri/{$lsLain->id}/generate-nisk")
            ->assertStatus(422);
    }

    public function test_13_generate_nisk_syarat_nis_lokal_dan_nsm(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Nisk Tiga');
        $ls = LembagaSantri::create([
            'santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'is_active_lembaga' => 'Ya',
        ]);

        // Tanpa nis_lokal → 422.
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/lembaga-santri/{$ls->id}/generate-nisk")
            ->assertStatus(422);

        // Lembaga tanpa NSM valid → 422 (nullable, menunggu dilengkapi).
        $lembagaTanpaNsm = Lembaga::create([
            'parent_id' => $f['root']->id, 'nama' => 'Lembaga Baru', 'kode' => 'LB',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $lsNsm = LembagaSantri::create([
            'santri_id' => $santri->id, 'lembaga_id' => $lembagaTanpaNsm->id, 'nis_lokal' => '26099', 'is_active_lembaga' => 'Ya',
        ]);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/lembaga-santri/{$lsNsm->id}/generate-nisk")
            ->assertStatus(422);
        $this->assertNull($lsNsm->fresh()->nis_kemenag);
    }

    // ---------- 14. policy keanggotaan ----------

    public function test_14_policy_tenant_berdasarkan_keanggotaan(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);

        $santriMi = $this->makeSantri('Milik MI');
        LembagaSantri::create(['santri_id' => $santriMi->id, 'lembaga_id' => $f['mi']->id, 'is_active_lembaga' => 'Ya']);

        // Admin MD boleh mengubah santri berkeanggotaan MI (pengecualian pasangan).
        $this->actingAs($adminMd, 'sanctum')->patchJson("/api/admin/santri/{$santriMi->id}", [
            'nama_singkat' => 'X',
        ])->assertStatus(200);

        // Santri tanpa keanggotaan = arsip pusat → boleh admin mana pun.
        $tanpa = $this->makeSantri('Arsip Pusat');
        $this->actingAs($adminMd, 'sanctum')->patchJson("/api/admin/santri/{$tanpa->id}", [
            'nama_singkat' => 'Pusat',
        ])->assertStatus(200);

        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/santri/{$santriMi->id}", [
            'nama_singkat' => 'MI',
        ])->assertStatus(200);
    }

    // ---------- 15. foto ----------

    public function test_15_upload_foto_dan_tenant(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);
        $santri = $this->makeSantri('Foto Satu');
        LembagaSantri::create(['santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'is_active_lembaga' => 'Ya']);

        $file = UploadedFile::fake()->image('foto.jpg');
        $this->actingAs($adminMi, 'sanctum')->post("/api/admin/santri/{$santri->id}/foto", [
            'foto' => $file,
        ])->assertStatus(201);
        $this->assertNotNull($santri->fresh()->foto_url);

        // Admin pasangan (MD) diizinkan.
        $this->actingAs($adminMd, 'sanctum')->post("/api/admin/santri/{$santri->id}/foto", [
            'foto' => UploadedFile::fake()->image('foto2.jpg'),
        ])->assertStatus(201);
    }

    public function test_16_daftar_santri_per_page_semua(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        // 105 baris: melewati bawaan 100 sehingga terlihat bila batas dipakai.
        for ($i = 1; $i <= 105; $i++) {
            $this->makeSantri('Santri List '.$i);
        }

        $bawaan = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri')->assertStatus(200);
        $this->assertCount(100, $bawaan->json('data'));

        // per_page=0 ("Semua") → seluruh baris dalam satu halaman.
        $semua = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri?per_page=0')->assertStatus(200);
        $this->assertCount(105, $semua->json('data'));
        $this->assertSame(1, $semua->json('last_page'));

        // Nilai tak sah (`per_page=all` versi huruf besar, `-5`) juga = semua.
        $all = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri?per_page=ALL')->assertStatus(200);
        $this->assertCount(105, $all->json('data'));

        $negatif = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri?per_page=-5')->assertStatus(200);
        $this->assertCount(105, $negatif->json('data'));
    }

    // ---------- 17-18. input/edit kolom Santri Per Jenjang ----------

    public function test_17_keanggotaan_input_nis_kemenag_status_dan_tanggal(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Anggota Isi');

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lembaga", [
            'lembaga_id' => $f['mi']->id,
            'nis_lokal' => '26005',
            'nis_kemenag' => '123456789012260005',
            'is_active_lembaga' => 'Ya',
            'tgl_masuk' => '2026-07-01',
            'tgl_selesai' => null,
        ])->assertStatus(201)->assertJsonPath('data.nis_kemenag', '123456789012260005');

        $ls = LembagaSantri::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame('123456789012260005', $ls->nis_kemenag);
        $this->assertSame('Ya', $ls->is_active_lembaga);
        $this->assertSame('2026-07-01', $ls->tgl_masuk?->format('Y-m-d'));

        // Nonaktif + tgl_selesai juga bisa langsung diisi saat menambah.
        $nonaktif = $this->makeSantri('Anggota Nonaktif');
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$nonaktif->id}/lembaga", [
            'lembaga_id' => $f['md']->id,
            'is_active_lembaga' => 'Tidak',
            'tgl_selesai' => '2026-06-30',
        ])->assertStatus(201);

        $lsNonaktif = LembagaSantri::where('santri_id', $nonaktif->id)->firstOrFail();
        $this->assertSame('Tidak', $lsNonaktif->is_active_lembaga);
        $this->assertSame('2026-06-30', $lsNonaktif->tgl_selesai?->format('Y-m-d'));

        // NIS Kemenag sama di lembaga yang sama → 422 dan tidak menyisakan baris.
        $lain = $this->makeSantri('Anggota Isi Dua');
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$lain->id}/lembaga", [
            'lembaga_id' => $f['mi']->id,
            'nis_kemenag' => '123456789012260005',
        ])->assertStatus(422);
        $this->assertSame(0, LembagaSantri::where('santri_id', $lain->id)->count());
    }

    public function test_18_keanggotaan_ubah_nis_kemenag_manual(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Anggota Ubah');
        $ls = LembagaSantri::create([
            'santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'nis_lokal' => '26007', 'is_active_lembaga' => 'Ya',
        ]);
        $lainMi = LembagaSantri::create([
            'santri_id' => $this->makeSantri('Anggota Ubah Mi')->id, 'lembaga_id' => $f['mi']->id, 'is_active_lembaga' => 'Ya',
        ]);
        $lainMd = LembagaSantri::create([
            'santri_id' => $this->makeSantri('Anggota Ubah Md')->id, 'lembaga_id' => $f['md']->id, 'is_active_lembaga' => 'Ya',
        ]);

        // Isi manual NIS Kemenag + tanggal mulai lewat dialog Ubah.
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$ls->id}", [
            'nis_kemenag' => '123456789012260007',
            'tgl_masuk' => '2026-07-05',
            'is_active_lembaga' => 'Tidak',
            'tgl_selesai' => '2026-12-31',
        ])->assertStatus(200);

        $ls->refresh();
        $this->assertSame('123456789012260007', $ls->nis_kemenag);
        $this->assertSame('2026-07-05', $ls->tgl_masuk?->format('Y-m-d'));
        $this->assertSame('Tidak', $ls->is_active_lembaga);
        $this->assertSame('2026-12-31', $ls->tgl_selesai?->format('Y-m-d'));

        // Bentrok NIS Kemenag di lembaga yang sama → 422 tanpa mengubah baris.
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$lainMi->id}", [
            'nis_kemenag' => '123456789012260007',
        ])->assertStatus(422);
        $this->assertNull($lainMi->fresh()->nis_kemenag);

        // Nomor sama di lembaga BERBEDA → boleh (unik per lembaga).
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$lainMd->id}", [
            'nis_kemenag' => '123456789012260007',
        ])->assertStatus(200);
        $this->assertSame('123456789012260007', $lainMd->fresh()->nis_kemenag);

        // Kosongkan NIS Kemenag (mis. salah input) → NULL, bukan string kosong.
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$ls->id}", [
            'nis_kemenag' => '',
        ])->assertStatus(200);
        $this->assertNull($ls->fresh()->nis_kemenag);
    }

    public function test_19_keanggotaan_field_masuk_dan_sekolah_asal(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Anggota Field');

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lembaga", [
            'lembaga_id' => $f['mi']->id,
            'nis_lokal' => '27001',
            'tahaj_masuk' => '2026/2027',
            'tingkat_masuk' => '1',
            'no_urut' => 5,
            'nama_sekolah_asal' => 'SD Negeri 1',
            'npsn_sekolah_asal' => '20512345',
            'nss_sekolah_asal' => '101010101010',
            'alamat_sekolah_asal' => 'Jl. Asal No. 1',
        ])->assertStatus(201);

        $ls = LembagaSantri::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame('2026/2027', $ls->tahaj_masuk);
        $this->assertSame('1', $ls->tingkat_masuk);
        $this->assertSame(5, $ls->no_urut);
        $this->assertSame('SD Negeri 1', $ls->nama_sekolah_asal);
        $this->assertSame('20512345', $ls->npsn_sekolah_asal);
        $this->assertSame('101010101010', $ls->nss_sekolah_asal);
        $this->assertSame('Jl. Asal No. 1', $ls->alamat_sekolah_asal);

        // Update sebagian + keaktifan string.
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$ls->id}", [
            'tingkat_masuk' => '2',
            'is_active_lembaga' => 'Tidak',
        ])->assertStatus(200);
        $ls->refresh();
        $this->assertSame('2', $ls->tingkat_masuk);
        $this->assertSame('Tidak', $ls->is_active_lembaga);

        // Keaktifan wajib 'Ya'/'Tidak'; no_urut wajib integer.
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$ls->id}", [
            'is_active_lembaga' => 'yes',
        ])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/lembaga-santri/{$ls->id}", [
            'no_urut' => 'abc',
        ])->assertStatus(422);

        // Profil santri: kepala_keluarga ikut profil biasa.
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/santri/{$santri->id}", [
            'kepala_keluarga' => 'Bapak Kepala',
        ])->assertStatus(200);
        $this->assertSame('Bapak Kepala', $santri->fresh()->kepala_keluarga);
    }
}
