<?php

namespace Tests\Feature;

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
                'user_id' => $u->id, 'jenjang' => $lid,
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

    // ---------- 01. index terskop tenant ----------

    public function test_01_index_terskop_tenant(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);

        $santriMi = $this->makeSantri('Santri MI');
        LembagaSantri::create(['santri_id' => $santriMi->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25001', 'is_active_lembaga' => 'Ya']);
        $santriMd = $this->makeSantri('Santri MD');
        LembagaSantri::create(['santri_id' => $santriMd->id, 'jenjang' => $f['md']->jenjang, 'nis_lokal' => '26001', 'is_active_lembaga' => 'Ya']);
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

    // ---------- 03. store manual identitas + keanggotaan (wajib jenjang) ----------

    public function test_03_store_manual_wajib_jenjang_dan_buat_keanggotaan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);

        // Tanpa jenjang → 422 (santri minimal terdaftar di 1 jenjang).
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/santri', [
            'nama_lengkap' => 'Tanpa Jenjang',
            'jk' => 'P',
        ])->assertStatus(422)->assertJsonValidationErrors(['jenjang']);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/santri', [
            'nama_lengkap' => 'Manual Satu',
            'jk' => 'P',
            'nik' => '1101010000000001',
            'nisn' => '1234567890',
            'jenjang' => $f['mi']->jenjang,
            'nis_lokal' => '25001',
        ])->assertStatus(201);

        $id = $res->json('data.id');
        $santri = Santri::findOrFail($id);
        $this->assertSame('Manual Satu', $santri->nama_lengkap);
        $this->assertSame(1, LembagaSantri::where('santri_id', $id)->count());
        $this->assertDatabaseHas('lembaga_santri', [
            'santri_id' => $id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25001', 'is_active_lembaga' => 'Ya',
        ]);
        // Tidak ada kolom relasional di payload master.
        $this->assertArrayNotHasKey('jenjang', $santri->getAttributes());
        $this->assertArrayNotHasKey('nis', $santri->getAttributes());
    }

    // ---------- 04. update identitas + validasi ----------

    public function test_04_update_identitas_dan_validasi(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
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

    // ---------- 10-11. keanggotaan ----------

    public function test_10_keanggotaan_nis_lokal_unik_per_lembaga_dan_multi_lembaga(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Anggota Satu');

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lembaga", [
            'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25010', 'tgl_masuk' => '2026-07-01',
        ])->assertStatus(201);

        // NIS lokal sama di lembaga yang sama → 422.
        $lain = $this->makeSantri('Anggota Dua');
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$lain->id}/lembaga", [
            'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25010',
        ])->assertStatus(422);

        // NIS lokal sama di lembaga BERBEDA → boleh (multi-lembaga paralel).
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$lain->id}/lembaga", [
            'jenjang' => $f['md']->jenjang, 'nis_lokal' => '25010',
        ])->assertStatus(201);

        // Bergabung juga ke MI dengan NIS lokal berbeda → dua keanggotaan aktif.
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$lain->id}/lembaga", [
            'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25011',
        ])->assertStatus(201);

        $this->assertSame(2, LembagaSantri::where('santri_id', $lain->id)->where('is_active_lembaga', 'Ya')->count());
    }

    public function test_11_keanggotaan_update_status_dan_tanggal(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Anggota Tiga');
        $ls = LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '25011', 'is_active_lembaga' => 'Ya',
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
            'santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '26001', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);
        $taMi = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'tahun_ajaran' => $taMi->nama, 'jenjang' => $f['mi']->jenjang,
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
            'santri_id' => $lain->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '36001', 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $lain->id, 'tahun_ajaran' => $taMi->nama, 'jenjang' => $f['mi']->jenjang,
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
            'santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya',
        ]);

        // Tanpa nis_lokal → 422.
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/lembaga-santri/{$ls->id}/generate-nisk")
            ->assertStatus(422);

        // Lembaga tanpa NSM valid → 422 (nullable, menunggu dilengkapi).
        $lembagaTanpaNsm = Lembaga::create([
            'nama' => 'Lembaga Baru', 'jenjang' => 'LB',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $lsNsm = LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => $lembagaTanpaNsm->jenjang, 'nis_lokal' => '26099', 'is_active_lembaga' => 'Ya',
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
        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);
        $adminMd = $this->makeUser('admin', [$f['md']->jenjang]);

        $santriMi = $this->makeSantri('Milik MI');
        LembagaSantri::create(['santri_id' => $santriMi->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);

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
        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);
        $adminMd = $this->makeUser('admin', [$f['md']->jenjang]);
        $santri = $this->makeSantri('Foto Satu');
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya']);

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
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);

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
            'jenjang' => $f['mi']->jenjang,
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
            'jenjang' => $f['md']->jenjang,
            'is_active_lembaga' => 'Tidak',
            'tgl_selesai' => '2026-06-30',
        ])->assertStatus(201);

        $lsNonaktif = LembagaSantri::where('santri_id', $nonaktif->id)->firstOrFail();
        $this->assertSame('Tidak', $lsNonaktif->is_active_lembaga);
        $this->assertSame('2026-06-30', $lsNonaktif->tgl_selesai?->format('Y-m-d'));

        // NIS Kemenag sama di lembaga yang sama → 422 dan tidak menyisakan baris.
        $lain = $this->makeSantri('Anggota Isi Dua');
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$lain->id}/lembaga", [
            'jenjang' => $f['mi']->jenjang,
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
            'santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'nis_lokal' => '26007', 'is_active_lembaga' => 'Ya',
        ]);
        $lainMi = LembagaSantri::create([
            'santri_id' => $this->makeSantri('Anggota Ubah Mi')->id, 'jenjang' => $f['mi']->jenjang, 'is_active_lembaga' => 'Ya',
        ]);
        $lainMd = LembagaSantri::create([
            'santri_id' => $this->makeSantri('Anggota Ubah Md')->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Ya',
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
            'jenjang' => $f['mi']->jenjang,
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
