<?php

namespace Tests\Feature;

use App\Exports\SantriTemplateExport;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Services\RefService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Tests\TestCase;

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
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'lembaga_id' => $root->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        // TA operasional per lembaga (aturan: TA tidak pernah milik root).
        $taMi = TahunAjaran::create([
            'lembaga_id' => $mi->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMd = TahunAjaran::create([
            'lembaga_id' => $md->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $kelasMi = Kelas::create([
            'lembaga_id' => $mi->id, 'tahun_ajaran_id' => $taMi->id,
            'nama_kelas' => 'I-A',
        ]);

        return compact('root', 'mi', 'md', 'ta', 'taMi', 'taMd', 'kelasMi');
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->userSeq,
            'email' => "santri101_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9100000000 + $this->userSeq * 137 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
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

    /**
     * Bangun file CSV sementara untuk import.
     * $rows = list baris asosiatif (kunci = nama header).
     */
    protected function makeCsv(array $rows): string
    {
        // CATAT: collection() mengakses $row['tipe_santri'] langsung (tanpa ?? null)
        // sehingga kolom ini WAJIB ada di file walau tak ada rules() validasinya.
        // CATAT: 'kewarganegaraan' NOT NULL default 'WNI', tapi import menulis
        // $row['kewarganegaraan'] ?? null (null eksplisit menimpa default DB),
        // sehingga kolom ini juga wajib ada di file bila ingin sukses.
        $headers = ['nama_lengkap', 'jk', 'kelas_id', 'nik', 'nis', 'nisn', 'tgl_lahir', 'hobi', 'tipe_santri', 'kewarganegaraan', 'lembaga_id'];
        $tmp = tempnam(sys_get_temp_dir(), 'santri101').'.csv';
        $h = fopen($tmp, 'w');
        fputcsv($h, $headers);
        foreach ($rows as $r) {
            $line = [];
            foreach ($headers as $col) {
                // Default template nyata: kolom kewarganegaraan selalu terisi.
                $line[] = $r[$col] ?? ($col === 'kewarganegaraan' ? 'WNI' : '');
            }
            fputcsv($h, $line);
        }
        fclose($h);

        return $tmp;
    }

    protected function importCsv(User $admin, ?int $tahunAjaranId, ?int $lembagaId, string $csvPath)
    {
        $file = new UploadedFile($csvPath, 'santri.csv', 'text/csv', null, true);
        $payload = ['file' => $file];
        if (! is_null($tahunAjaranId)) {
            $payload['tahun_ajaran_id'] = $tahunAjaranId;
        }
        if (! is_null($lembagaId)) {
            $payload['lembaga_id'] = $lembagaId;
        }

        return $this->actingAs($admin, 'sanctum')
            ->post('/api/admin/santri/import-lengkap', $payload);
    }

    // ---------- 1. index terskop tenant ----------

    public function test_01_index_terskop_tenant(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);

        Santri::create([
            'lembaga_id' => $f['mi']->id, 'nama_lengkap' => 'Santri MI Satu',
            'jk' => 'L', 'status_global' => true,
        ]);
        Santri::create([
            'lembaga_id' => $f['md']->id, 'nama_lengkap' => 'Santri MD Satu',
            'jk' => 'P', 'status_global' => true,
        ]);

        // Admin MI hanya melihat santri MI.
        $resMi = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/santri');
        $resMi->assertStatus(200);
        $namesMi = collect($resMi->json('data'))->pluck('nama_lengkap')->all();
        $this->assertContains('Santri MI Satu', $namesMi);
        $this->assertNotContains('Santri MD Satu', $namesMi);

        // PERILAKU AKTUAL (catat): index admin TIDAK 403 lintas lembaga —
        // tenant ditegakkan via scoping: admin MD hanya melihat santri MD.
        $resMd = $this->actingAs($adminMd, 'sanctum')->getJson('/api/admin/santri');
        $resMd->assertStatus(200);
        $namesMd = collect($resMd->json('data'))->pluck('nama_lengkap')->all();
        $this->assertContains('Santri MD Satu', $namesMd);
        $this->assertNotContains('Santri MI Satu', $namesMd);

        // Filter ?lembaga_id= milik lembaga lain juga tidak membocorkan:
        // controller index tidak memakai filter lembaga_id (abaikan), tetap scope milik sendiri.
        $resCross = $this->actingAs($adminMd, 'sanctum')
            ->getJson('/api/admin/santri?lembaga_id='.$f['mi']->id);
        $resCross->assertStatus(200);
        $namesCross = collect($resCross->json('data'))->pluck('nama_lengkap')->all();
        $this->assertNotContains('Santri MI Satu', $namesCross);
    }

    // ---------- 2. guru ditolak ----------

    public function test_02_guru_akses_index_ditolak(): void
    {
        $f = $this->baseFixture();
        $guru = $this->makeUser('guru', [$f['mi']->id]);

        // PERILAKU AKTUAL: 403 via middleware role (route admin hanya super_admin|admin);
        // policy SantriPolicy::viewAny juga false untuk guru.
        $this->actingAs($guru, 'sanctum')
            ->getJson('/api/admin/santri')
            ->assertStatus(403);
    }

    // ---------- 3. import sukses 2 baris ----------

    public function test_03_import_sukses_dua_baris_dengan_riwayat(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $hobiLangka = 'Koleksi Layang Naga Langka 101';
        $csv = $this->makeCsv([
            [
                'nama_lengkap' => 'Impor Anak Satu', 'jk' => 'L', 'kelas_id' => $f['kelasMi']->id,
                'nik' => '1101010000000001', 'nis' => 'S1001', 'tgl_lahir' => '2015-01-10',
                'hobi' => $hobiLangka,
            ],
            [
                'nama_lengkap' => 'Impor Anak Dua', 'jk' => 'P', 'kelas_id' => $f['kelasMi']->id,
                'nik' => '1101010000000002', 'nis' => 'S1002', 'tgl_lahir' => '2015-02-20',
                'hobi' => 'Membaca',
            ],
        ]);

        $res = $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $csv);
        $res->assertStatus(200);
        $res->assertJsonPath('pesan', 'Data santri berhasil diimport.');

        $this->assertEquals(2, Santri::count());
        // Kamus string bebas: nilai langka tersimpan apa adanya (tanpa exists).
        $this->assertDatabaseHas('santri', [
            'nama_lengkap' => 'Impor Anak Satu', 'nik' => '1101010000000001', 'hobi' => $hobiLangka,
        ]);

        // Riwayat perdana per santri (semester 1, lembaga + tahun ajaran import).
        $this->assertEquals(2, RiwayatBelajar::count());
        foreach (Santri::all() as $s) {
            $this->assertDatabaseHas('riwayat_belajar', [
                'santri_id' => $s->id,
                'tahun_ajaran_id' => $f['taMi']->id,
                'lembaga_id' => $f['mi']->id,
                'semester' => '1',
                'status_awal' => 'santri_baru',
                'status_akhir' => 'aktif',
            ]);
        }
    }

    // ---------- 4. import baris gagal: skip-lanjut ----------

    public function test_04_import_baris_gagal_skip_lanjut(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $csv = $this->makeCsv([
            [
                'nama_lengkap' => 'Impor Valid Empat', 'jk' => 'L', 'kelas_id' => $f['kelasMi']->id,
                'nik' => '1101010000000004', 'tgl_lahir' => '2015-04-04',
            ],
            [
                // Baris gagal: nama kosong + nik pendek (2 pelanggaran sekaligus).
                'nama_lengkap' => '', 'jk' => 'L', 'kelas_id' => $f['kelasMi']->id,
                'nik' => '123', 'tgl_lahir' => '2015-05-05',
            ],
        ]);

        $res = $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $csv);
        $res->assertStatus(422);
        $res->assertJsonPath('pesan', 'Gagal mengimport beberapa data.');
        $this->assertNotEmpty($res->json('errors'));

        // Baris valid tetap masuk.
        $this->assertDatabaseHas('santri', ['nama_lengkap' => 'Impor Valid Empat']);
        $this->assertEquals(1, Santri::count());
    }

    // ---------- 5. NIS-via-NIK: import 2x = update ----------

    public function test_05_import_nik_sama_update_bukan_ganda(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $row = [
            'nama_lengkap' => 'Impor Anak Lima', 'jk' => 'L', 'kelas_id' => $f['kelasMi']->id,
            'nik' => '1101010000000005', 'nis' => 'S5001', 'tgl_lahir' => '2015-06-06',
        ];

        $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $this->makeCsv([$row]))
            ->assertStatus(200);
        $this->assertEquals(1, Santri::count());

        // Import kedua: NIK + nama + tgl_lahir sama, NIS berbeda -> update, tetap 1 santri.
        $row['nis'] = 'S5002';
        $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $this->makeCsv([$row]))
            ->assertStatus(200);
        $this->assertEquals(1, Santri::where('nik', '1101010000000005')->count());
        $this->assertDatabaseHas('santri', [
            'nik' => '1101010000000005', 'nama_lengkap' => 'Impor Anak Lima', 'nis' => 'S5002',
        ]);
    }

    // ---------- 6. NIK kosong 2 baris = 2 santri ----------

    public function test_06_import_nik_kosong_tidak_saling_menimpa(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $csv = $this->makeCsv([
            ['nama_lengkap' => 'Tanpa NIK A', 'jk' => 'L', 'kelas_id' => $f['kelasMi']->id, 'tgl_lahir' => '2015-07-07'],
            ['nama_lengkap' => 'Tanpa NIK B', 'jk' => 'P', 'kelas_id' => $f['kelasMi']->id, 'tgl_lahir' => '2015-08-08'],
        ]);

        $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $csv)->assertStatus(200);

        $this->assertEquals(2, Santri::count());
        $this->assertDatabaseHas('santri', ['nama_lengkap' => 'Tanpa NIK A']);
        $this->assertDatabaseHas('santri', ['nama_lengkap' => 'Tanpa NIK B']);
    }

    // ---------- 7. kamus efektif per lembaga ----------

    public function test_07_kamus_efektif_per_lembaga(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $nama = 'Hobi Langka Santri101 XYZ';

        $store = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/referensi/hobi', [
            'nama' => $nama, 'lembaga_id' => $f['mi']->id,
        ]);
        $store->assertStatus(201);

        $diMi = $this->getJson('/api/kamus/hobi?lembaga_id='.$f['mi']->id);
        $diMi->assertStatus(200);
        $this->assertContains($nama, collect($diMi->json('data'))->pluck('nama')->all());

        // Lembaga lain tidak melihat baris khusus MI.
        $diMd = $this->getJson('/api/kamus/hobi?lembaga_id='.$f['md']->id);
        $diMd->assertStatus(200);
        $this->assertNotContains($nama, collect($diMd->json('data'))->pluck('nama')->all());
    }

    // ---------- 8. upload foto ----------

    public function test_08_upload_foto_mengisi_foto_url(): void
    {
        Storage::fake('local');

        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $santri = Santri::create([
            'lembaga_id' => $f['mi']->id, 'nama_lengkap' => 'Foto Anak',
            'jk' => 'L', 'status_global' => true,
        ]);

        $res = $this->actingAs($adminMi, 'sanctum')->post(
            "/api/admin/santri/{$santri->id}/foto",
            ['foto' => UploadedFile::fake()->image('foto.jpg', 100, 100)]
        );

        // PERILAKU AKTUAL (catat): controller me-return 201, bukan 200 seperti bunyi tugas.
        $res->assertStatus(201);
        $fotoUrl = $res->json('data.foto_url');
        $this->assertNotEmpty($fotoUrl);
        Storage::disk('local')->assertExists($fotoUrl);
        $this->assertDatabaseHas('santri', ['id' => $santri->id, 'foto_url' => $fotoUrl]);
    }

    // ---------- 9. tenant tulis: admin MD -> santri MI ----------

    public function test_09_tenant_tulis_upload_foto_lintas_lembaga_ditolak(): void
    {
        Storage::fake('local');

        $f = $this->baseFixture();
        $adminMd = $this->makeUser('admin', [$f['md']->id]);

        $santriMi = Santri::create([
            'lembaga_id' => $f['mi']->id, 'nama_lengkap' => 'Foto Anak MI',
            'jk' => 'L', 'status_global' => true,
        ]);

        $this->actingAs($adminMd, 'sanctum')->post(
            "/api/admin/santri/{$santriMi->id}/foto",
            ['foto' => UploadedFile::fake()->image('foto.jpg', 100, 100)]
        )->assertStatus(403);
    }

    // ---------- 10. NIK pendek ditolak ----------

    public function test_10_nik_non_16_digit_ditolak(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $csv = $this->makeCsv([
            [
                'nama_lengkap' => 'NIK Pendek', 'jk' => 'L', 'kelas_id' => $f['kelasMi']->id,
                'nik' => '12345', 'tgl_lahir' => '2015-09-09',
            ],
        ]);

        // Rules aktual import: 'nik' => nullable|digits:16 -> NIK fiktif BOLEH
        // selama 16 digit; non-16 digit -> 422.
        $res = $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $csv);
        $res->assertStatus(422);
        $res->assertJsonPath('pesan', 'Gagal mengimport beberapa data.');
        $this->assertNotEmpty($res->json('errors'));
        $this->assertEquals(0, Santri::count());
    }

    // ---------- 11. edit sel inline (PATCH) + NIS unik ----------

    public function test_11_edit_santri_inline_dan_nis_unik(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);

        $csv = $this->makeCsv([
            [
                'nama_lengkap' => 'Anak Edit Satu', 'jk' => 'L', 'kelas_id' => $f['kelasMi']->id,
                'nik' => '1102020000000001', 'nis' => 'E1001', 'tgl_lahir' => '2015-03-03',
            ],
            [
                'nama_lengkap' => 'Anak Edit Dua', 'jk' => 'P', 'kelas_id' => $f['kelasMi']->id,
                'nik' => '1102020000000002', 'nis' => 'E1002', 'tgl_lahir' => '2015-04-04',
            ],
        ]);
        $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $csv)->assertStatus(200);

        $s1 = Santri::where('nis', 'E1001')->firstOrFail();
        $s2 = Santri::where('nis', 'E1002')->firstOrFail();

        // Edit sebagian: nama + JK + tanggal lahir.
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/santri/{$s1->id}", [
            'nama_lengkap' => 'Anak Edit Satu (Revisi)',
            'jk' => 'P',
            'tgl_lahir' => '2015-05-05',
        ])->assertStatus(200)->assertJsonPath('data.nama_lengkap', 'Anak Edit Satu (Revisi)');
        $s1->refresh();
        $this->assertSame('P', $s1->jk);
        $this->assertSame('2015-05-05', $s1->tgl_lahir?->format('Y-m-d'));

        // NIS duplikat ditolak.
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/santri/{$s1->id}", ['nis' => 'E1002'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nis']);

        // NIS unik untuk dirinya sendiri + mirror ke riwayat aktif.
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/santri/{$s1->id}", ['nis' => 'E1009'])
            ->assertStatus(200)
            ->assertJsonPath('data.nis', 'E1009');
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $s1->id, 'nis' => 'E1009', 'is_aktif' => true]);

        // NIS panjang (>10, ≤20) diterima + mirror ke riwayat aktif.
        $nisPanjang = 'E1009000000000001';
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/santri/{$s1->id}", ['nis' => $nisPanjang])
            ->assertStatus(200)
            ->assertJsonPath('data.nis', $nisPanjang);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $s1->id, 'nis' => $nisPanjang, 'is_aktif' => true]);

        // Validasi format: NIK non-16 digit & JK asing ditolak.
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/santri/{$s1->id}", ['nik' => '123'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nik']);
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/santri/{$s1->id}", ['jk' => 'X'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['jk']);

        // Profil lengkap (jalur utama): alamat, orang tua, wali, dll.
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/santri/{$s1->id}", [
            'alamat' => 'Jl. Pesantren 1',
            'provinsi' => 'Jawa Barat',
            'kab_kota' => 'Bandung',
            'ayah_nama' => 'Ayah Satu',
            'ayah_pekerjaan' => 'Petani',
            'ibu_nama' => 'Ibu Satu',
            'wali_nama' => 'Wali Satu',
            'yang_membiayai' => 'Ayah',
            'tanggal_masuk' => '2026-07-01',
        ])->assertStatus(200);
        $s1->refresh();
        $this->assertSame('Jl. Pesantren 1', $s1->alamat);
        $this->assertSame('Ayah Satu', $s1->ayah_nama);
        $this->assertSame('Wali Satu', $s1->wali_nama);
        $this->assertSame('2026-07-01', $s1->tanggal_masuk?->format('Y-m-d'));

        // Kolom di luar whitelist (relasional) diabaikan.
        $this->actingAs($adminMi, 'sanctum')->patchJson("/api/admin/santri/{$s1->id}", ['lembaga_id' => 999])
            ->assertStatus(200);
        $this->assertNotSame(999, $s1->fresh()->lembaga_id);

        // Admin lembaga lain tidak boleh mengedit.
        $this->actingAs($adminMd, 'sanctum')->patchJson("/api/admin/santri/{$s2->id}", ['nama_lengkap' => 'Hack'])
            ->assertStatus(403);
    }

    // ---------- 12. legacy tanpa lembaga (v1.10) ----------

    public function test_12_santri_legacy_tanpa_lembaga_terlihat_semua_admin_dan_bisa_diedit(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);

        $legacy = Santri::create(['lembaga_id' => null, 'nama_lengkap' => 'Santri Legacy', 'jk' => 'L']);
        // Status turunan murni: default nonaktif sampai punya riwayat aktif.
        $this->assertFalse((bool) $legacy->fresh()->status_global);

        // Terlihat admin scoped mana pun (arsip pusat).
        foreach ([$adminMi, $adminMd] as $admin) {
            $this->actingAs($admin, 'sanctum')->getJson('/api/admin/santri')
                ->assertStatus(200)
                ->assertJsonFragment(['nama_lengkap' => 'Santri Legacy']);
        }

        // Edit + akses dokumen lintas-lembaga boleh (lembaga_id NULL).
        $this->actingAs($adminMd, 'sanctum')->patchJson("/api/admin/santri/{$legacy->id}", ['nama_singkat' => 'Legacy'])
            ->assertStatus(200);
        $this->assertSame('Legacy', $legacy->fresh()->nama_singkat);
        $this->actingAs($adminMi, 'sanctum')->getJson("/api/admin/santri/{$legacy->id}/dokumen")
            ->assertStatus(200);
    }

    // ---------- 13. input manual: aturan lembaga (v1.10) ----------

    public function test_13_store_manual_mengikuti_aturan_lembaga(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminRangkap = $this->makeUser('admin', [$f['mi']->id, $f['md']->id]);
        $superAdmin = $this->makeUser('super_admin', []);

        // Admin 1 lembaga → lembaga otomatis; legacy nonaktif (tanpa riwayat).
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/santri', [
            'nama_lengkap' => 'Input MI', 'jk' => 'L',
        ])->assertStatus(201)
            ->assertJsonPath('data.lembaga_id', $f['mi']->id)
            ->assertJsonPath('data.status_global', false);

        // Admin rangkap tanpa pilih lembaga → null (legacy).
        $this->actingAs($adminRangkap, 'sanctum')->postJson('/api/admin/santri', [
            'nama_lengkap' => 'Input Rangkap', 'jk' => 'P',
        ])->assertStatus(201)
            ->assertJsonPath('data.lembaga_id', null);

        // Lembaga di luar kewenangan → 403; di dalam kewenangan → dipakai.
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/santri', [
            'nama_lengkap' => 'Input Luar', 'jk' => 'L', 'lembaga_id' => $f['md']->id,
        ])->assertStatus(403);
        $this->actingAs($adminRangkap, 'sanctum')->postJson('/api/admin/santri', [
            'nama_lengkap' => 'Input Pilih', 'jk' => 'L', 'lembaga_id' => $f['md']->id,
        ])->assertStatus(201)
            ->assertJsonPath('data.lembaga_id', $f['md']->id);

        // Super admin tanpa lembaga → null.
        $this->actingAs($superAdmin, 'sanctum')->postJson('/api/admin/santri', [
            'nama_lengkap' => 'Input Super', 'jk' => 'L',
        ])->assertStatus(201)
            ->assertJsonPath('data.lembaga_id', null);

        // JK wajib.
        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/santri', ['nama_lengkap' => 'Tanpa JK'])
            ->assertStatus(422)->assertJsonValidationErrors(['jk']);
    }

    // ---------- 14. import legacy: lembaga per baris / tanpa lembaga ----------

    public function test_14_import_tanpa_lembaga_menjadi_legacy_tanpa_riwayat(): void
    {
        $f = $this->baseFixture();
        $superAdmin = $this->makeUser('super_admin', []);

        // Tanpa lembaga & tanpa TA → santri legacy (tanpa riwayat, nonaktif).
        $csv = $this->makeCsv([
            ['nama_lengkap' => 'Legacy Import', 'jk' => 'L'],
        ]);
        $this->importCsv($superAdmin, null, null, $csv)->assertStatus(200);

        $legacy = Santri::where('nama_lengkap', 'Legacy Import')->firstOrFail();
        $this->assertNull($legacy->lembaga_id);
        $this->assertFalse((bool) $legacy->status_global);
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $legacy->id)->count());

        // Kolom `lembaga_id` di template menang → riwayat terbentuk + status aktif.
        $csvLembaga = $this->makeCsv([
            ['nama_lengkap' => 'Import Berlembaga', 'jk' => 'P', 'lembaga_id' => (string) $f['mi']->id],
        ]);
        $this->importCsv($superAdmin, $f['taMi']->id, null, $csvLembaga)->assertStatus(200);

        $berlembaga = Santri::where('nama_lengkap', 'Import Berlembaga')->firstOrFail();
        $this->assertEquals($f['mi']->id, (int) $berlembaga->lembaga_id);
        $this->assertTrue((bool) $berlembaga->status_global);
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $berlembaga->id)->count());
    }

    // ---------- 15. template Excel selaras dengan import ----------

    public function test_15_template_excel_selaras_import(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $export = new SantriTemplateExport;
        $headings = $export->headings();
        $contoh = $export->array()[0];
        $this->assertSame(count($headings), count($contoh));
        $this->assertContains('lembaga_id', $headings);

        $tmp = tempnam(sys_get_temp_dir(), 'tmpl_santri').'.xlsx';
        file_put_contents($tmp, Excel::raw($export, \Maatwebsite\Excel\Excel::XLSX));

        // Baris contoh template harus lolos import tanpa penyesuaian kolom.
        $this->actingAs($adminMi, 'sanctum')->post('/api/admin/santri/import-lengkap', [
            'tahun_ajaran_id' => $f['taMi']->id,
            'file' => new UploadedFile($tmp, 'template-santri.xlsx', null, null, true),
        ])->assertStatus(200);

        $santri = Santri::where('nama_lengkap', 'Ahmad Fauzi')->firstOrFail();
        $this->assertEquals($f['mi']->id, (int) $santri->lembaga_id);
        $this->assertTrue((bool) $santri->status_global);

        // Endpoint unduh template: lingkup lembaga + TA ikut menentukan dropdown kelas.
        $this->actingAs($adminMi, 'sanctum')->get('/api/admin/santri/import-template')->assertStatus(200);
        $this->actingAs($adminMi, 'sanctum')
            ->get('/api/admin/santri/import-template?lembaga_id='.$f['mi']->id.'&tahun_ajaran_id='.$f['taMi']->id)
            ->assertStatus(200);
        // TA lembaga lain → 422 (dropdown tidak boleh menyilang lingkup).
        $this->actingAs($adminMi, 'sanctum')
            ->get('/api/admin/santri/import-template?tahun_ajaran_id='.$f['taMd']->id)
            ->assertStatus(422);
    }

    // ---------- 16. periksa import (dry-run) sebelum import ----------

    public function test_16_import_periksa_dry_run_tanpa_menulis(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $kelasMd = Kelas::create([
            'lembaga_id' => $f['md']->id, 'tahun_ajaran_id' => $f['taMd']->id, 'nama_kelas' => 'I-MD',
        ]);

        // 1 baris valid + 1 baris kelas beda lembaga.
        $csv = $this->makeCsv([
            ['nama_lengkap' => 'Valid Satu', 'jk' => 'L'],
            ['nama_lengkap' => 'Salah Kelas', 'jk' => 'P', 'kelas_id' => (string) $kelasMd->id],
        ]);

        $res = $this->actingAs($adminMi, 'sanctum')->post('/api/admin/santri/import-periksa', [
            'tahun_ajaran_id' => $f['taMi']->id,
            'file' => new UploadedFile($csv, 'periksa.csv', 'text/csv', null, true),
        ])->assertStatus(200);

        $res->assertJsonPath('siap_import', false)
            ->assertJsonPath('ringkasan.baris_diproses', 2)
            ->assertJsonPath('ringkasan.baris_valid', 1)
            ->assertJsonPath('ringkasan.baris_gagal', 1);

        // Dry-run tidak menulis apa pun.
        $this->assertSame(0, Santri::count());
        $this->assertSame(0, RiwayatBelajar::count());

        // File bersih → siap_import true; tetap tanpa tulisan.
        $csvOk = $this->makeCsv([['nama_lengkap' => 'Bersih', 'jk' => 'L']]);
        $this->actingAs($adminMi, 'sanctum')->post('/api/admin/santri/import-periksa', [
            'tahun_ajaran_id' => $f['taMi']->id,
            'file' => new UploadedFile($csvOk, 'bersih.csv', 'text/csv', null, true),
        ])->assertStatus(200)->assertJsonPath('siap_import', true);
        $this->assertSame(0, Santri::count());

        // Import nyata tetap berjalan setelah lolos periksa.
        $this->importCsv($adminMi, $f['taMi']->id, null, $csvOk)->assertStatus(200);
        $this->assertSame(1, Santri::count());

        // Batas panjang NIS (≤20): 20 karakter valid, 21 karakter gagal — tetap tanpa tulisan.
        $csvNis = $this->makeCsv([
            ['nama_lengkap' => 'Nis Batas', 'jk' => 'L', 'nis' => str_repeat('7', 20)],
            ['nama_lengkap' => 'Nis Lewat', 'jk' => 'L', 'nis' => str_repeat('7', 21)],
        ]);
        $resNis = $this->actingAs($adminMi, 'sanctum')->post('/api/admin/santri/import-periksa', [
            'tahun_ajaran_id' => $f['taMi']->id,
            'file' => new UploadedFile($csvNis, 'nis.csv', 'text/csv', null, true),
        ])->assertStatus(200);
        $resNis->assertJsonPath('ringkasan.baris_valid', 1)
            ->assertJsonPath('ringkasan.baris_gagal', 1);
        $this->assertSame(1, Santri::count());
    }

    // ---------- 17. template bergaya: warna wajib + dropdown ref ----------

    public function test_17_template_bergaya_dan_dropdown_referensi(): void
    {
        $f = $this->baseFixture();
        DB::table('ref_agama')->insert([
            'lembaga_id' => null, 'nama' => 'Islam', 'urutan' => 0, 'is_active' => true,
        ]);
        RefService::forget();

        $xlsx = Excel::raw(new SantriTemplateExport($f['mi']->id), \Maatwebsite\Excel\Excel::XLSX);
        $tmp = tempnam(sys_get_temp_dir(), 'tmpl_style').'.xlsx';
        file_put_contents($tmp, $xlsx);
        $spreadsheet = IOFactory::load($tmp);
        $sheet = $spreadsheet->getActiveSheet();

        $kolom = SantriTemplateExport::kolom();
        $colOf = fn (string $nama) => Coordinate::stringFromColumnIndex(array_search($nama, $kolom, true) + 1);

        // Header: wajib kuning, opsional biru.
        $this->assertSame('FFFFE699', $sheet->getStyle($colOf('nama_lengkap').'1')->getFill()->getStartColor()->getARGB());
        $this->assertSame('FFDCE6F1', $sheet->getStyle($colOf('nama_singkat').'1')->getFill()->getStartColor()->getARGB());

        // Dropdown enum jk.
        $dvJk = $sheet->getDataValidation($colOf('jk').'2');
        $this->assertSame(DataValidation::TYPE_LIST, $dvJk->getType());
        $this->assertTrue($dvJk->getAllowBlank());
        $this->assertTrue($dvJk->getShowDropDown());

        // Excel hanya menampilkan panah dropdown bila XML berisi showDropDown="0"
        // (atribut OOXML inverted; default PhpSpreadsheet menulis "1" = tersembunyi).
        $zip = new \ZipArchive;
        $this->assertTrue($zip->open($tmp));
        $xmlSheet = $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();
        $this->assertIsString($xmlSheet);
        $this->assertStringContainsString('showDropDown="0"', $xmlSheet);
        $this->assertStringNotContainsString('showDropDown="1"', $xmlSheet);

        // Dropdown kamus agama (nilai live dari RefService) menunjuk sheet Referensi.
        $dvAgama = $sheet->getDataValidation($colOf('agama').'2');
        $this->assertSame(DataValidation::TYPE_LIST, $dvAgama->getType());
        $this->assertStringContainsString('Referensi', $dvAgama->getFormula1());

        $referensi = $spreadsheet->getSheetByName('Referensi');
        $this->assertNotNull($referensi);
        $this->assertSame(Worksheet::SHEETSTATE_HIDDEN, $referensi->getSheetState());

        // Nilai referensi efektif tersimpan di sheet Referensi.
        $colAgama = null;
        for ($i = 1; $i <= 60; $i++) {
            $col = Coordinate::stringFromColumnIndex($i);
            if ($referensi->getCell($col.'1')->getValue() === 'pilihan_agama') {
                $colAgama = $col;
                break;
            }
        }
        $this->assertNotNull($colAgama);
        $this->assertSame('Islam', $referensi->getCell($colAgama.'2')->getValue());
    }

    // ---------- 18. import menolak TA bukan milik lembaga baris ----------

    public function test_18_import_ta_silang_lembaga_ditolak_per_baris(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        // File ber-TA MD untuk baris MI (scoped otomatis MI) → gagal per baris.
        $csv = $this->makeCsv([['nama_lengkap' => 'TA Silang', 'jk' => 'L']]);
        $res = $this->actingAs($adminMi, 'sanctum')->post('/api/admin/santri/import-periksa', [
            'tahun_ajaran_id' => $f['taMd']->id,
            'file' => new UploadedFile($csv, 'silang.csv', 'text/csv', null, true),
        ])->assertStatus(200);

        $res->assertJsonPath('siap_import', false)
            ->assertJsonPath('ringkasan.baris_gagal', 1);
        $this->assertStringContainsString(
            'Tahun ajaran',
            (string) json_encode($res->json('errors'))
        );
        $this->assertSame(0, Santri::count());
    }

    // ---------- 19. import menolak lembaga root ----------

    public function test_19_import_lembaga_root_ditolak(): void
    {
        $f = $this->baseFixture();
        $superAdmin = $this->makeUser('super_admin', []);

        // Kolom per baris berisi id root → gagal validasi baris.
        $csv = $this->makeCsv([
            ['nama_lengkap' => 'Root Baris', 'jk' => 'L', 'lembaga_id' => (string) $f['root']->id],
        ]);
        $this->actingAs($superAdmin, 'sanctum')->post('/api/admin/santri/import-periksa', [
            'tahun_ajaran_id' => $f['taMi']->id,
            'file' => new UploadedFile($csv, 'root.csv', 'text/csv', null, true),
        ])->assertStatus(200)->assertJsonPath('siap_import', false);

        // Level file berisi id root → 422 langsung (resolusi lembaga).
        $csvOk = $this->makeCsv([['nama_lengkap' => 'Root File', 'jk' => 'L']]);
        $this->actingAs($superAdmin, 'sanctum')->post('/api/admin/santri/import-lengkap', [
            'tahun_ajaran_id' => $f['taMi']->id,
            'lembaga_id' => $f['root']->id,
            'file' => new UploadedFile($csvOk, 'root-file.csv', 'text/csv', null, true),
        ])->assertStatus(422);
        $this->assertSame(0, Santri::count());
    }

    // ---------- 20. import: kolom kelas menerima nama (nama dulu), id, atau kosong ----------

    public function test_20_import_kelas_boleh_nama_id_atau_kosong(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        // Kelas bernama "1" dibuat setelah kelas lain agar id-nya bukan 1 —
        // membuktikan nama diutamakan atas id.
        $kelasX = Kelas::create([
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id, 'nama_kelas' => 'X',
        ]);
        $kelasSatu = Kelas::create([
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id, 'nama_kelas' => '1',
        ]);

        $csv = $this->makeCsv([
            ['nama_lengkap' => 'Lewat Nama', 'jk' => 'L', 'kelas_id' => '1'],
            ['nama_lengkap' => 'Lewat Id', 'jk' => 'L', 'kelas_id' => (string) $kelasX->id],
            ['nama_lengkap' => 'Tanpa Kelas', 'jk' => 'L'],
        ]);
        $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $csv)->assertStatus(200);

        // Nama menang: "1" = kelas bernama "1", bukan kelas ber-id 1.
        $lewatNama = Santri::where('nama_lengkap', 'Lewat Nama')->firstOrFail();
        $this->assertSame($kelasSatu->id, (int) $lewatNama->kelas_id);
        $this->assertSame($kelasSatu->id, (int) RiwayatBelajar::where('santri_id', $lewatNama->id)->value('kelas_id'));

        // Angka tanpa nama yang cocok → jatuh ke id.
        $lewatId = Santri::where('nama_lengkap', 'Lewat Id')->firstOrFail();
        $this->assertSame($kelasX->id, (int) $lewatId->kelas_id);

        // Kosong → santri tanpa kelas (riwayat tetap terbentuk).
        $tanpaKelas = Santri::where('nama_lengkap', 'Tanpa Kelas')->firstOrFail();
        $this->assertNull($tanpaKelas->kelas_id);
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $tanpaKelas->id)->count());
    }

    // ---------- 21. import: kelas lintas lingkup ditolak, legacy hanya boleh id ----------

    public function test_21_import_kelas_lintas_lingkup_dan_legacy(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $superAdmin = $this->makeUser('super_admin', []);

        $kelasMd = Kelas::create([
            'lembaga_id' => $f['md']->id, 'tahun_ajaran_id' => $f['taMd']->id, 'nama_kelas' => 'I-MD',
        ]);

        // Nama kelas lembaga lain → gagal per baris.
        $csvNama = $this->makeCsv([['nama_lengkap' => 'Salah Nama', 'jk' => 'L', 'kelas_id' => 'I-MD']]);
        $res = $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $csvNama)->assertStatus(422);
        $this->assertStringContainsString('kelas_id', (string) json_encode($res->json('errors')));
        $this->assertSame(0, Santri::count());

        // Id kelas lembaga lain → gagal (tidak diam-diam dipakai walau id-nya valid).
        $csvId = $this->makeCsv([['nama_lengkap' => 'Salah Id', 'jk' => 'L', 'kelas_id' => (string) $kelasMd->id]]);
        $this->importCsv($adminMi, $f['taMi']->id, $f['mi']->id, $csvId)->assertStatus(422);
        $this->assertSame(0, Santri::count());

        // Legacy tanpa lembaga/TA: id diterima sebagai cache, tanpa riwayat.
        $csvLegacyId = $this->makeCsv([['nama_lengkap' => 'Legacy Id', 'jk' => 'L', 'kelas_id' => (string) $f['kelasMi']->id]]);
        $this->importCsv($superAdmin, null, null, $csvLegacyId)->assertStatus(200);
        $legacy = Santri::where('nama_lengkap', 'Legacy Id')->firstOrFail();
        $this->assertSame($f['kelasMi']->id, (int) $legacy->kelas_id);
        $this->assertSame(0, RiwayatBelajar::where('santri_id', $legacy->id)->count());

        // Legacy tanpa lingkup: nama tidak bisa dipastikan → gagal.
        $csvLegacyNama = $this->makeCsv([['nama_lengkap' => 'Legacy Nama', 'jk' => 'L', 'kelas_id' => 'I-A']]);
        $this->importCsv($superAdmin, null, null, $csvLegacyNama)->assertStatus(422);
    }

    // ---------- 22. template: dropdown nama kelas per lingkup lembaga + TA ----------

    public function test_22_template_dropdown_kelas_mengikuti_lingkup(): void
    {
        $f = $this->baseFixture();

        // Tanpa TA: dropdown kelas tidak dibuat (kolom tetap menerima teks bebas).
        $tanpaTa = new SantriTemplateExport($f['mi']->id);
        $this->assertArrayNotHasKey('kelas_id', $tanpaTa->pilihan());

        // Lingkup lengkap: daftar nama kelas urut tingkat lalu nama.
        Kelas::create([
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id,
            'nama_kelas' => '2A', 'tingkat' => '2',
        ]);
        $pilihan = (new SantriTemplateExport($f['mi']->id, $f['taMi']->id))->pilihan();
        $this->assertSame(['I-A', '2A'], $pilihan['kelas_id']);
    }
}
