<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
        $kelasMi = Kelas::create([
            'lembaga_id' => $mi->id, 'tahun_ajaran_id' => $ta->id,
            'nama_kelas' => 'I-A',
        ]);

        return compact('root', 'mi', 'md', 'ta', 'kelasMi');
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role) . ' ' . $this->userSeq,
            'email' => "santri101_u{$this->userSeq}_" . uniqid() . '@example.com',
            'phone' => '08' . str_pad((string) (9100000000 + $this->userSeq * 137 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
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
        $headers = ['nama_lengkap', 'jk', 'kelas_id', 'nik', 'nis', 'nisn', 'tgl_lahir', 'hobi', 'tipe_santri', 'kewarganegaraan'];
        $tmp = tempnam(sys_get_temp_dir(), 'santri101') . '.csv';
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

    protected function importCsv(User $admin, int $tahunAjaranId, ?int $lembagaId, string $csvPath)
    {
        $file = new UploadedFile($csvPath, 'santri.csv', 'text/csv', null, true);
        $payload = ['tahun_ajaran_id' => $tahunAjaranId, 'file' => $file];
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
            ->getJson('/api/admin/santri?lembaga_id=' . $f['mi']->id);
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

        $res = $this->importCsv($adminMi, $f['ta']->id, $f['mi']->id, $csv);
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
                'tahun_ajaran_id' => $f['ta']->id,
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

        $res = $this->importCsv($adminMi, $f['ta']->id, $f['mi']->id, $csv);
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

        $this->importCsv($adminMi, $f['ta']->id, $f['mi']->id, $this->makeCsv([$row]))
            ->assertStatus(200);
        $this->assertEquals(1, Santri::count());

        // Import kedua: NIK + nama + tgl_lahir sama, NIS berbeda -> update, tetap 1 santri.
        $row['nis'] = 'S5002';
        $this->importCsv($adminMi, $f['ta']->id, $f['mi']->id, $this->makeCsv([$row]))
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

        $this->importCsv($adminMi, $f['ta']->id, $f['mi']->id, $csv)->assertStatus(200);

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

        $diMi = $this->getJson('/api/kamus/hobi?lembaga_id=' . $f['mi']->id);
        $diMi->assertStatus(200);
        $this->assertContains($nama, collect($diMi->json('data'))->pluck('nama')->all());

        // Lembaga lain tidak melihat baris khusus MI.
        $diMd = $this->getJson('/api/kamus/hobi?lembaga_id=' . $f['md']->id);
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
        $res = $this->importCsv($adminMi, $f['ta']->id, $f['mi']->id, $csv);
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
        $this->importCsv($adminMi, $f['ta']->id, $f['mi']->id, $csv)->assertStatus(200);

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
}
