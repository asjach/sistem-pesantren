<?php

namespace Tests\Feature;

use App\Exports\PsbTemplateExport;
use App\Models\DokumenSantri;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\PengajuanBiodataSantri;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKegiatan;
use App\Models\PsbKuotaBiaya;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Models\WaliSantriRelasi;
use Database\Seeders\ReferensiSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class PsbFlowTest extends TestCase
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
        $mts = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Tsanawiyah', 'kode' => 'MTS',
            'is_seleksi' => true, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
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
        $taMts = TahunAjaran::create([
            'lembaga_id' => $mts->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $keg = PsbKegiatan::create([
            'tahun_ajaran_id' => $ta->id, 'nama' => 'PSB 2026/2027', 'is_aktif' => true,
        ]);
        $gel = PsbGelombang::create([
            'psb_kegiatan_id' => $keg->id, 'nomor' => 1, 'nama' => 'Gelombang 1 2026/2027',
            'tgl_buka' => now()->subDays(30)->toDateString(),
            'tgl_tutup' => now()->addDays(30)->toDateString(),
        ]);

        return compact('root', 'mi', 'md', 'mts', 'ta', 'taMi', 'taMd', 'taMts', 'keg', 'gel');
    }

    protected function makeKuota($gel, $lembaga, $ta, array $opt = []): PsbKuotaBiaya
    {
        return PsbKuotaBiaya::create(array_merge([
            'gelombang_id' => $gel->id,
            'lembaga_id' => $lembaga->id,
            'tipe_santri' => 'non_asrama',
            'paket_tersedia' => false,
            'kuota' => null,
            'membutuhkan_seleksi' => false,
            'membutuhkan_pemberkasan' => true,
        ], $opt));
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role, array $lembagaIds = [], ?string $email = null, ?string $phone = null): User
    {
        $this->userSeq++;
        $email = $email ?? "user{$this->userSeq}_".uniqid().'@example.com';
        $phone = $phone ?? '08'.str_pad((string) (9000000000 + $this->userSeq * 137 + random_int(0, 99)), 10, '0', STR_PAD_LEFT);
        // pastikan 12-14 digit unik
        $u = User::create([
            'name' => ucfirst($role).' '.$this->userSeq,
            'email' => $email,
            'phone' => $phone,
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

    protected function daftarPayload($gel, $lembaga, string $nik, string $nama, string $email, string $telp, array $extra = []): array
    {
        return array_merge([
            'gelombang_id' => $gel->id,
            'lembaga_id' => $lembaga->id,
            'tipe_santri' => 'non_asrama',
            'nik' => $nik,
            'nama_lengkap' => $nama,
            'jk' => 'L',
            'tgl_lahir' => '2015-05-01',
            'email_ortu' => $email,
            'telp_ortu' => $telp,
        ], $extra);
    }

    // ---------- 1. daftar publik sukses ----------

    public function test_01_daftar_publik_sukses(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);

        $nik = '1100000000000001';
        $res = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], $nik, 'Ahmad Satu', 'ortu1@example.com', '081111111111'
        ));

        $res->assertStatus(201);
        $no = $res->json('data.no_pendaftaran');
        $this->assertNotEmpty($no);
        $this->assertStringStartsWith('PSB_', $no);
        $calonId = $res->json('data.calon.id');
        $this->assertNotEmpty($calonId);

        $this->assertDatabaseHas('psb_calon_santri', ['id' => $calonId, 'status_pendaftaran' => 'baru']);
        $this->assertDatabaseHas('psb_log_status', ['psb_calon_santri_id' => $calonId, 'ke' => 'baru']);
    }

    // ---------- 2. daftar ganda identik ----------

    public function test_02_daftar_ganda_identik_ditolak(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);

        // DEVIATION-2 (sqlite :memory:): kolom tgl_lahir bertipe DATE menyimpan
        // '2015-05-01 00:00:00' di sqlite sehingga where('tgl_lahir','2015-05-01')
        // di PsbService::daftarPublik tidak cocok (di MySQL DATE cocok).
        // Untuk menguji dedup nik+nama+tgl_lahir secara deterministik di sqlite,
        // pakai tgl_lahir=null (whereNull cocok di kedua DB).
        $payload = $this->daftarPayload($f['gel'], $f['mi'], '1100000000000002', 'Budi Ganda', 'ortu2@example.com', '081222222222');
        unset($payload['tgl_lahir']);
        $this->postJson('/api/psb/daftar', $payload)->assertStatus(201);
        $res2 = $this->postJson('/api/psb/daftar', $payload);
        $res2->assertStatus(422);
        $res2->assertJsonValidationErrors(['nik']);
    }

    // ---------- 3. NIK santri aktif ----------

    public function test_03_nik_santri_aktif_diarahkan_lanjutan(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);

        $nik = '1100000000000003';
        Santri::create([
            'lembaga_id' => $f['mi']->id, 'nama_lengkap' => 'Santri Aktif', 'nik' => $nik,
            'jk' => 'L', 'tgl_lahir' => '2014-01-01', 'status_global' => true,
        ]);

        $res = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], $nik, 'Santri Aktif', 'ortu3@example.com', '081333333333',
            ['tgl_lahir' => '2014-01-01']
        ));
        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['nik']);
        $this->assertStringContainsStringIgnoringCase('lanjutan', (string) $res->getContent());
    }

    // ---------- 4. paket MI-MD ----------

    public function test_04_paket_mi_md_acc(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], [
            'membutuhkan_seleksi' => false, 'paket_tersedia' => true,
        ]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $nik = '1100000000000004';
        $res = $this->postJson('/api/psb/daftar-paket', $this->daftarPayload(
            $f['gel'], $f['mi'], $nik, 'Paket Anak', 'ortu4@example.com', '081444444444'
        ));
        $res->assertStatus(201);
        $calonId = $res->json('data.calon.id');
        $this->assertNotEmpty($calonId);

        $calon = PsbCalonSantri::with('lembagaDetail')->findOrFail($calonId);
        $this->assertStringContainsString('MIMD', $calon->no_pendaftaran);
        $this->assertEquals($f['mi']->id, (int) $calon->lembaga_id);
        $this->assertCount(2, $calon->lembagaDetail);
        $this->assertEquals(
            collect([$f['mi']->id, $f['md']->id])->sort()->values()->all(),
            $calon->lembagaDetail->pluck('lembaga_id')->sort()->values()->all()
        );
        $this->assertEquals('1', $calon->lembagaDetail->firstWhere('lembaga_id', $f['mi']->id)->masuk_tingkat);
        $this->assertEquals('1', $calon->lembagaDetail->firstWhere('lembaga_id', $f['md']->id)->masuk_tingkat);

        // Alur normal: admin verifikasi -> ortu ajukan -> admin ACC
        $this->actingAs($adminMi, 'sanctum')->postJson("/api/psb/{$calonId}/verifikasi")->assertStatus(200);
        $this->assertEquals('terverifikasi', PsbCalonSantri::find($calonId)->status_pendaftaran);

        $wali = $this->makeUser('orang_tua', [], 'ortu4@example.com', '081444444444');
        $this->actingAs($wali, 'sanctum')
            ->postJson("/api/portal/psb/{$calonId}/ajukan-daftar-ulang")
            ->assertStatus(201);

        DokumenSantri::create(['psb_calon_santri_id' => $calonId, 'jenis_dokumen_santri' => 'kk', 'path_file' => 'psb/dokumen/kk1.pdf']);

        $acc = $this->actingAs($adminMi, 'sanctum')->postJson("/api/psb/{$calonId}/acc-daftar-ulang");
        $acc->assertStatus(201);
        $santriId = $acc->json('data.id');
        $this->assertNotEmpty($santriId);

        $this->assertEquals(1, Santri::where('id', $santriId)->count());
        // 2 riwayat aktif (MI + MD)
        $this->assertEquals(2, RiwayatBelajar::where('santri_id', $santriId)->where('is_aktif', true)->count());
        $this->assertEquals(1, RiwayatBelajar::where('santri_id', $santriId)->where('lembaga_id', $f['mi']->id)->count());
        $this->assertEquals(1, RiwayatBelajar::where('santri_id', $santriId)->where('lembaga_id', $f['md']->id)->count());
        // dokumen pindah ke santri
        $this->assertEquals(1, DokumenSantri::where('santri_id', $santriId)->count());
        $this->assertEquals(0, DokumenSantri::where('psb_calon_santri_id', $calonId)->count());
        $this->assertEquals('daftar_ulang', PsbCalonSantri::find($calonId)->status_pendaftaran);
    }

    public function test_04b_daftar_paket_tanpa_sinyal_ditolak(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta'], ['membutuhkan_seleksi' => false]);

        $res = $this->postJson('/api/psb/daftar-paket', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000401', 'Paket Tutup', 'ortu4b@example.com', '081444444401'
        ));
        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['paket']);
    }

    // ---------- 5. jalur seleksi penuh ----------

    public function test_05_jalur_seleksi_lolos_sampai_acc(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mts'], $f['ta'], ['membutuhkan_seleksi' => true]);
        $admin = $this->makeUser('admin', [$f['mts']->id]);
        $ortu = $this->makeUser('orang_tua', [], 'ortu5@example.com', '081555555555');

        $nik = '1100000000000005';
        $daftar = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mts'], $nik, 'Seleksi Anak', 'ortu5@example.com', '081555555555'
        ));
        $daftar->assertStatus(201);
        $calonId = $daftar->json('data.calon.id');

        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/verifikasi")->assertStatus(200);
        $this->assertEquals('terverifikasi', PsbCalonSantri::find($calonId)->status_pendaftaran);

        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/seleksi", ['lolos' => true])
            ->assertStatus(200);
        $this->assertEquals('lolos', PsbCalonSantri::find($calonId)->status_pendaftaran);

        $this->actingAs($ortu, 'sanctum')->putJson("/api/portal/psb/{$calonId}/lengkapi", ['jk' => 'L', 'alamat' => 'Jl. Test 5'])
            ->assertStatus(200);
        $this->assertEquals('Jl. Test 5', PsbCalonSantri::find($calonId)->alamat);

        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/psb/{$calonId}/ajukan-daftar-ulang")
            ->assertStatus(201);
        $this->assertEquals('ajukan_daftar_ulang', PsbCalonSantri::find($calonId)->status_pendaftaran);

        $acc = $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/acc-daftar-ulang");
        $acc->assertStatus(201);
        $santriId = $acc->json('data.id');
        $this->assertNotEmpty($santriId);
        $this->assertDatabaseHas('santri', ['id' => $santriId, 'nik' => $nik]);
    }

    // ---------- 6. jalur langsung ----------

    public function test_06_jalur_langsung_tolak_seleksi(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $ortu = $this->makeUser('orang_tua', [], 'ortu6@example.com', '081666666666');

        $nik = '1100000000000006';
        $daftar = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], $nik, 'Langsung Anak', 'ortu6@example.com', '081666666666'
        ));
        $daftar->assertStatus(201);
        $calonId = $daftar->json('data.calon.id');

        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/verifikasi")->assertStatus(200);

        // jalur langsung: seleksi wajib 422
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/seleksi", ['lolos' => true])
            ->assertStatus(422);

        // alur langsung verifikasi -> ajukan -> acc sukses
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/psb/{$calonId}/ajukan-daftar-ulang")
            ->assertStatus(201);
        $acc = $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/acc-daftar-ulang");
        $acc->assertStatus(201);
        $this->assertNotEmpty($acc->json('data.id'));
    }

    // ---------- 7. hapus (soft delete) + pulihkan ----------

    public function test_07_hapus_soft_delete_dan_pulihkan(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], [
            'membutuhkan_seleksi' => false, 'paket_tersedia' => true,
        ]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $d1 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000007', 'Hapus Satu', 'ortu7a@example.com', '081777777771'
        ))->json('data.calon.id');

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/psb/{$d1}")->assertStatus(200);

        $terhapus = PsbCalonSantri::withTrashed()->find($d1);
        $this->assertNotNull($terhapus->deleted_at);
        $this->assertEquals($admin->id, (int) $terhapus->deleted_by);
        // tidak muncul di antrean & kuota
        $antrean = $this->actingAs($admin, 'sanctum')->getJson('/api/psb/antrean-daftar-ulang?status=baru');
        $this->assertNotContains($d1, collect($antrean->json('data.data'))->pluck('id')->all());

        // daftar ulang dianggap nomor terpakai (tidak didaur ulang)
        $next = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000071', 'Hapus Dua', 'ortu7c@example.com', '081777777773'
        ));
        $next->assertStatus(201);
        $this->assertNotEquals(
            $terhapus->no_pendaftaran,
            $next->json('data.no_pendaftaran')
        );

        // pulihkan
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$d1}/pulihkan")->assertStatus(200);
        $this->assertNull(PsbCalonSantri::find($d1)->deleted_at);

        // hapus setelah pulihkan tetap bisa
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/psb/{$d1}")->assertStatus(200);
        $this->assertNotNull(PsbCalonSantri::withTrashed()->find($d1)->deleted_at);
    }

    public function test_25_bulk_verifikasi_seleksi_acc_partial(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => true]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $adminLain = $this->makeUser('admin', [$f['mts']->id]);

        $ids = [];
        foreach (['a', 'b'] as $i => $suf) {
            $ids[] = $this->postJson('/api/psb/daftar', $this->daftarPayload(
                $f['gel'], $f['mi'], '110000000000018'.$i, 'Bulk '.strtoupper($suf),
                "ortu25{$suf}@example.com", '08182555555'.$i
            ))->json('data.calon.id');
        }

        // 1 berhasil + 1 lintas tenant gagal
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/verifikasi', [
            'ids' => [$ids[0], $ids[1]],
        ]);
        $res->assertStatus(200);
        $this->assertSame([$ids[0], $ids[1]], $res->json('data.berhasil'));

        // admin lembaga lain -> semua gagal (tetap 200 dengan laporan)
        $res2 = $this->actingAs($adminLain, 'sanctum')->postJson('/api/psb/bulk/verifikasi', [
            'ids' => [$ids[0]],
        ]);
        $res2->assertStatus(200);
        $this->assertCount(1, $res2->json('data.gagal'));

        // bulk seleksi: 1 valid, 1 status salah (belum terverifikasi)
        $c3 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000182', 'Bulk C', 'ortu25c@example.com', '081825555552'
        ))->json('data.calon.id');
        $seleksi = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/seleksi', [
            'ids' => [$ids[1], $c3], 'lolos' => true,
        ]);
        $seleksi->assertStatus(200);
        $this->assertSame([$ids[1]], $seleksi->json('data.berhasil'));
        $this->assertCount(1, $seleksi->json('data.gagal'));
        $this->assertEquals('lolos', PsbCalonSantri::find($ids[1])->status_pendaftaran);
    }

    public function test_26_bulk_hapus_dan_pulihkan(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $a = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000190', 'Bulk Hapus A', 'ortu26a@example.com', '081826666661'
        ))->json('data.calon.id');
        $b = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000191', 'Bulk Hapus B', 'ortu26b@example.com', '081826666662'
        ))->json('data.calon.id');

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/hapus', ['ids' => [$a, $b, 999999]]);
        $res->assertStatus(200);
        $this->assertEqualsCanonicalizing([$a, $b], $res->json('data.berhasil'));
        $this->assertCount(1, $res->json('data.gagal'));
        $this->assertNotNull(PsbCalonSantri::withTrashed()->find($a)->deleted_at);

        // terhapus muncul lewat filter terhapus, tidak di antrean biasa
        $terhapus = $this->actingAs($admin, 'sanctum')->getJson('/api/psb/antrean-daftar-ulang?status=baru&terhapus=1');
        $this->assertContains($a, collect($terhapus->json('data.data'))->pluck('id')->all());

        $pulih = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/pulihkan', ['ids' => [$a, $b]]);
        $pulih->assertStatus(200);
        $this->assertCount(2, $pulih->json('data.berhasil'));
        $this->assertNull(PsbCalonSantri::find($a)->deleted_at);
    }

    // ---------- 8. kuota + waiting + promosi ----------

    public function test_08_kuota_penuh_waiting_dan_promosi(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false, 'kuota' => 1]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $c1 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000009', 'Kuota Satu', 'ortu8a@example.com', '081888888881'
        ));
        $c1->assertStatus(201);
        $this->assertEquals('baru', $c1->json('data.calon.status_pendaftaran'));
        $id1 = $c1->json('data.calon.id');

        $c2 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000010', 'Kuota Dua', 'ortu8b@example.com', '081888888882'
        ));
        $c2->assertStatus(201);
        $this->assertEquals('waiting_list', $c2->json('data.calon.status_pendaftaran'));
        $id2 = $c2->json('data.calon.id');

        // promosi saat penuh -> 422
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/promosi")->assertStatus(422);

        // longgarkan: hapus pendaftar pertama
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/psb/{$id1}")->assertStatus(200);

        // promosi kini -> baru
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/promosi")->assertStatus(200);
        $this->assertEquals('baru', PsbCalonSantri::find($id2)->status_pendaftaran);
    }

    // ---------- 9. tenant lintas lembaga ----------

    public function test_09_tenant_lintas_lembaga_ditolak(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $this->makeKuota($f['gel'], $f['mts'], $f['ta'], ['membutuhkan_seleksi' => true]);
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminMts = $this->makeUser('admin', [$f['mts']->id]);
        $ortu = $this->makeUser('orang_tua', [], 'ortu9@example.com', '081999999999');

        // verifikasi lintas lembaga -> 403
        $c1 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000011', 'Tenant Satu', 'ortu9a@example.com', '081999999991'
        ))->json('data.calon.id');
        $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$c1}/verifikasi")->assertStatus(403);

        // siapkan calon ajukan milik MI
        $c2 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000012', 'Tenant Dua', 'ortu9@example.com', '081999999999'
        ))->json('data.calon.id');
        $this->actingAs($adminMi, 'sanctum')->postJson("/api/psb/{$c2}/verifikasi")->assertStatus(200);
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/psb/{$c2}/ajukan-daftar-ulang")->assertStatus(201);

        // ACC lintas lembaga -> 403
        $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$c2}/acc-daftar-ulang")->assertStatus(403);
    }

    // ---------- 10. portal + biodata ----------

    public function test_10_portal_lengkapi_ajukan_dan_biodata(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $ortu = $this->makeUser('orang_tua', [], 'ortu10@example.com', '082000000000');

        $nik = '1100000000000013';
        $calonId = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], $nik, 'Portal Anak', 'ortu10@example.com', '082000000000'
        ))->json('data.calon.id');

        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/verifikasi")->assertStatus(200);

        // lengkapi tahap-2
        $len = $this->actingAs($ortu, 'sanctum')->putJson("/api/portal/psb/{$calonId}/lengkapi", [
            'jk' => 'L', 'alamat' => 'Jl. Portal 10', 'tmp_lahir' => 'Demak',
        ]);
        $len->assertStatus(200);
        $this->assertEquals('Jl. Portal 10', PsbCalonSantri::find($calonId)->alamat);

        // ajukan daftar ulang
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/psb/{$calonId}/ajukan-daftar-ulang")
            ->assertStatus(201);

        // acc -> santri
        $santriId = $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/acc-daftar-ulang")
            ->json('data.id');
        $this->assertNotEmpty($santriId);

        // relasi wali-anak untuk portal biodata
        WaliSantriRelasi::create([
            'user_id' => $ortu->id, 'santri_id' => $santriId,
            'hubungan' => 'ayah', 'is_utama' => true, 'is_active' => true,
        ]);

        // pengajuan biodata pertama -> 201, kedua -> 422
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/santri/{$santriId}/pengajuan-biodata", [
            'diff' => ['alamat' => 'Jl. Baru 10'],
        ])->assertStatus(201);

        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/santri/{$santriId}/pengajuan-biodata", [
            'diff' => ['alamat' => 'Jl. Kedua 10'],
        ])->assertStatus(422);
    }

    // ---------- 11. is_pindahan + masuk_tingkat ----------

    public function test_11_pindahan_dan_tingkat_masuk(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $ortu = $this->makeUser('orang_tua', [], 'ortu11@example.com', '081111111111');

        // Pindahan MI tingkat 3: OK.
        $daftar = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000011', 'Pindahan Anak', 'ortu11@example.com', '081111111111',
            ['is_pindahan' => true, 'masuk_tingkat' => '3']
        ));
        $daftar->assertStatus(201);
        $calonId = $daftar->json('data.calon.id');
        $this->assertTrue((bool) PsbCalonSantri::find($calonId)->is_pindahan);
        $detailPindahan = PsbCalonSantri::find($calonId)->lembagaDetail()->firstOrFail();
        $this->assertEquals('3', $detailPindahan->masuk_tingkat);

        // Pindahan MI tingkat 7 (luar 2-6): 422.
        $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000012', 'Pindahan Salah', 'ortu11@example.com', '081111111111',
            ['is_pindahan' => true, 'masuk_tingkat' => '7']
        ))->assertStatus(422);

        // Santri baru MI tingkat 2 (bukan entry 1): 422.
        $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000013', 'Baru Salah', 'ortu11@example.com', '081111111111',
            ['masuk_tingkat' => '2']
        ))->assertStatus(422);

        // Alur sampai ACC: riwayat pindahan tingkat 3.
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/verifikasi")->assertStatus(200);
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/psb/{$calonId}/ajukan-daftar-ulang")
            ->assertStatus(201);
        $santriId = $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$calonId}/acc-daftar-ulang")
            ->json('data.id');
        $riwayat = RiwayatBelajar::where('santri_id', $santriId)->firstOrFail();
        $this->assertEquals('pindahan', $riwayat->status_awal);
        $this->assertEquals('3', $riwayat->tingkat);

        // Santri baru MTS tanpa tingkat: default entry 7.
        $this->makeKuota($f['gel'], $f['mts'], $f['ta'], ['membutuhkan_seleksi' => true]);
        $adminMts = $this->makeUser('admin', [$f['mts']->id]);
        $baru = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mts'], '1100000000000014', 'Baru MTS', 'ortu11@example.com', '081111111111'
        ));
        $baru->assertStatus(201);
        $calonBaru = $baru->json('data.calon.id');
        $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$calonBaru}/verifikasi")->assertStatus(200);
        $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$calonBaru}/seleksi", ['lolos' => true])
            ->assertStatus(200);
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/psb/{$calonBaru}/ajukan-daftar-ulang")
            ->assertStatus(201);
        $santriBaru = $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$calonBaru}/acc-daftar-ulang")
            ->json('data.id');
        $riwayatBaru = RiwayatBelajar::where('santri_id', $santriBaru)->firstOrFail();
        $this->assertEquals('santri_baru', $riwayatBaru->status_awal);
        $this->assertEquals('7', $riwayatBaru->tingkat);
    }

    // ---------- 12. template Excel import PSB ----------

    public function test_12_template_import_psb_bisa_diunduh(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $res = $this->actingAs($admin, 'sanctum')->get('/api/psb/import-template');

        $res->assertStatus(200);
        $disposisi = (string) $res->headers->get('content-disposition');
        $this->assertStringContainsString('attachment', $disposisi);
        $this->assertStringContainsString('template-import-psb.xlsx', $disposisi);
    }

    // ---------- 13. antrean timeline: badge per status + filter multi-status ----------

    public function test_13_antrean_badge_dan_filter_multi_status(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $ids = [];
        foreach ([['1100000000000101', 'Calon Baru'], ['1100000000000102', 'Calon Verif'], ['1100000000000103', 'Calon Ajukan']] as $i => [$nik, $nama]) {
            $res = $this->postJson('/api/psb/daftar', $this->daftarPayload(
                $f['gel'], $f['mi'], $nik, $nama, "ortu13{$i}@example.com", '0813000000'.$i
            ));
            $res->assertStatus(201);
            $ids[] = $res->json('data.calon.id');
        }
        PsbCalonSantri::find($ids[1])->update(['status_pendaftaran' => 'terverifikasi']);
        PsbCalonSantri::find($ids[2])->update(['status_pendaftaran' => 'ajukan_daftar_ulang']);

        // Filter multi-status (dipakai tahapan timeline "ditolak/tidak_lolos" dsb).
        $res = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/psb/antrean-daftar-ulang?status=terverifikasi,ajukan_daftar_ulang');

        $res->assertStatus(200)
            ->assertJsonPath('badge.baru', 1)
            ->assertJsonPath('badge.terverifikasi', 1)
            ->assertJsonPath('badge.ajukan_daftar_ulang', 1);
        $this->assertEqualsCanonicalizing(
            ['terverifikasi', 'ajukan_daftar_ulang'],
            collect($res->json('data.data'))->pluck('status_pendaftaran')->all(),
        );
    }

    // ---------- 14. input pendaftar manual oleh admin + dropdown gelombang ----------

    public function test_14_admin_input_pendaftar_manual(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/calon', [
            'gelombang_id' => $f['gel']->id,
            'lembaga_id' => $f['mi']->id,
            'tipe_santri' => 'non_asrama',
            'nik' => '1100000000000201',
            'nama_lengkap' => 'Pendaftar Manual',
            'jk' => 'L',
            'tgl_lahir' => '2015-01-01',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.status_pendaftaran', 'baru')
            ->assertJsonPath('data.nama_lengkap', 'Pendaftar Manual');
        $this->assertDatabaseHas('psb_calon_santri', [
            'nik' => '1100000000000201', 'status_pendaftaran' => 'baru', 'lembaga_id' => $f['mi']->id,
        ]);

        // Tenant: admin lembaga lain tidak boleh input ke MI.
        $adminMd = $this->makeUser('admin', [$f['md']->id]);
        $this->actingAs($adminMd, 'sanctum')->postJson('/api/psb/calon', [
            'gelombang_id' => $f['gel']->id,
            'lembaga_id' => $f['mi']->id,
            'tipe_santri' => 'non_asrama',
            'nik' => '1100000000000202',
            'nama_lengkap' => 'Salah Lembaga',
        ])->assertStatus(403);

        // Dropdown gelombang admin.
        $this->actingAs($admin, 'sanctum')->getJson('/api/psb/gelombang')
            ->assertStatus(200)
            ->assertJsonPath('data.0.id', $f['gel']->id);

        // Antrean menandai kebutuhan seleksi: MI tanpa seleksi, MTs dengan seleksi.
        $this->makeKuota($f['gel'], $f['mts'], $f['ta'], ['membutuhkan_seleksi' => true]);
        $adminMts = $this->makeUser('admin', [$f['mts']->id]);
        $this->actingAs($adminMts, 'sanctum')->postJson('/api/psb/calon', [
            'gelombang_id' => $f['gel']->id,
            'lembaga_id' => $f['mts']->id,
            'tipe_santri' => 'non_asrama',
            'nik' => '1100000000000203',
            'nama_lengkap' => 'Pendaftar MTs',
        ])->assertStatus(201);

        $antrean = $this->actingAs($admin, 'sanctum')->getJson('/api/psb/antrean-daftar-ulang?status=baru,terverifikasi');
        $antrean->assertStatus(200);
        $rows = collect($antrean->json('data.data'));
        $this->assertFalse((bool) $rows->firstWhere('nik', '1100000000000201')['butuh_seleksi']);

        $antreanMts = $this->actingAs($adminMts, 'sanctum')->getJson('/api/psb/antrean-daftar-ulang?status=baru,terverifikasi');
        $rowsMts = collect($antreanMts->json('data.data'));
        $this->assertTrue((bool) $rowsMts->firstWhere('nik', '1100000000000203')['butuh_seleksi']);
    }

    // ---------- 15. jalur publik dilarang memakai santri_asal_id (IDOR) ----------

    public function test_15_daftar_publik_menolak_santri_asal_id(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false, 'paket_tersedia' => true]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta'], ['membutuhkan_seleksi' => false]);

        $korban = Santri::create([
            'lembaga_id' => $f['mi']->id, 'nama_lengkap' => 'Korban IDOR', 'nik' => '1100000000000301',
            'jk' => 'L', 'tgl_lahir' => '2014-01-01', 'status_global' => true,
        ]);

        $res = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000302', 'Anak Penyerang', 'ortu15@example.com', '081515151515',
            ['santri_asal_id' => $korban->id]
        ));
        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['santri_asal_id']);

        $this->assertEquals('Korban IDOR', $korban->fresh()->nama_lengkap);
        $this->assertEquals(0, PsbCalonSantri::where('santri_asal_id', $korban->id)->count());
        $this->assertDatabaseMissing('psb_calon_santri', ['nik' => '1100000000000302']);

        $resPaket = $this->postJson('/api/psb/daftar-paket', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000303', 'Paket Penyerang', 'ortu15b@example.com', '081515151516',
            ['santri_asal_id' => $korban->id]
        ));
        $resPaket->assertStatus(422)->assertJsonValidationErrors(['santri_asal_id']);
    }

    // ---------- 16. portal riwayat tanpa email/phone/anak = kosong ----------

    public function test_16_portal_riwayat_tanpa_kriteria_tidak_bocor(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000311', 'Calon Orang Lain', 'oranglain@example.com', '081616161611'
        ))->assertStatus(201);

        $ortu = User::create(['name' => 'Ortu Tanpa Kontak', 'password' => 'password']);
        $ortu->assignRole('orang_tua');

        $res = $this->actingAs($ortu, 'sanctum')->getJson('/api/portal/psb/riwayat');
        $res->assertStatus(200)->assertJsonCount(0, 'data');
        $this->assertDatabaseCount('psb_calon_santri', 1);
    }

    // ---------- 17. gelombang di luar rentang tanggal ditolak ----------

    public function test_17_gelombang_di_luar_rentang_ditolak(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $f['gel']->update([
            'tgl_buka' => now()->subDays(60)->toDateString(),
            'tgl_tutup' => now()->subDay()->toDateString(),
        ]);

        $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000321', 'Gelombang Tutup', 'ortu17@example.com', '081717171717'
        ))->assertStatus(422)->assertJsonValidationErrors(['gelombang_id']);
    }

    // ---------- 18. nilai biodata divalidasi + batalkan aman ----------

    public function test_18_biodata_validasi_nilai_setujui_cast_dan_batalkan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $ortu = $this->makeUser('orang_tua', [], 'ortu18@example.com', '081818181818');

        $santri = Santri::create([
            'lembaga_id' => $f['mi']->id, 'nama_lengkap' => 'Anak Biodata', 'jk' => 'L',
            'tgl_lahir' => '2013-03-04', 'status_global' => true,
        ]);
        WaliSantriRelasi::create([
            'user_id' => $ortu->id, 'santri_id' => $santri->id,
            'hubungan' => 'ayah', 'is_utama' => true, 'is_active' => true,
        ]);

        // Nilai tidak valid per field -> 422.
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/santri/{$santri->id}/pengajuan-biodata", [
            'diff' => ['nama_lengkap' => str_repeat('A', 150)],
        ])->assertStatus(422)->assertJsonValidationErrors(['nama_lengkap']);

        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/santri/{$santri->id}/pengajuan-biodata", [
            'diff' => ['tgl_lahir' => 'bukan-tanggal'],
        ])->assertStatus(422)->assertJsonValidationErrors(['tgl_lahir']);

        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/santri/{$santri->id}/pengajuan-biodata", [
            'diff' => ['status_global' => false],
        ])->assertStatus(422);

        // Pengajuan valid -> 201, lalu batalkan -> status dibatalkan.
        $id = $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/santri/{$santri->id}/pengajuan-biodata", [
            'diff' => ['tgl_lahir' => '2012-02-03', 'alamat' => 'Jl. Biodata 18'],
        ])->assertStatus(201)->json('data.id');
        $this->assertNotEmpty($id);

        $this->actingAs($ortu, 'sanctum')->deleteJson("/api/portal/pengajuan-biodata/{$id}/batal")
            ->assertStatus(200);
        $this->assertEquals('dibatalkan', PengajuanBiodataSantri::findOrFail($id)->status);

        // Pengajuan baru + setujui: cast tanggal diterapkan ke santri.
        $id2 = $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/santri/{$santri->id}/pengajuan-biodata", [
            'diff' => ['tgl_lahir' => '2012-02-03'],
        ])->assertStatus(201)->json('data.id');
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/pengajuan-biodata/{$id2}/setujui")
            ->assertStatus(200);
        $this->assertEquals('2012-02-03', Santri::findOrFail($santri->id)->tgl_lahir->toDateString());
        $this->assertEquals('disetujui', PengajuanBiodataSantri::findOrFail($id2)->status);
    }

    // ---------- 19-20. import PSB: nomor kosong digenerate, duplikat ditolak ----------

    protected function xlsxFile(array $rows): UploadedFile
    {
        $headings = (new PsbTemplateExport)->headings();
        $data = [$headings];
        foreach ($rows as $row) {
            $data[] = array_map(fn ($h) => $row[$h] ?? '', $headings);
        }

        $spreadsheet = new Spreadsheet;
        $spreadsheet->getActiveSheet()->fromArray($data, null, 'A1');
        $path = tempnam(sys_get_temp_dir(), 'psbimport').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        return new UploadedFile(
            $path, 'import-psb.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null, true
        );
    }

    public function test_19_import_psb_tanpa_nomor_digenerate(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $row = [
            'nik' => '1100000000000401', 'nama_lengkap' => 'Import Satu', 'jk' => 'L',
            'tgl_lahir' => '2015-01-01', 'tipe_santri' => 'non_asrama', 'no_pendaftaran' => '',
        ];

        $this->actingAs($admin, 'sanctum')->post('/api/psb/import', [
            'gelombang_id' => $f['gel']->id,
            'lembaga_id' => $f['mi']->id,
            'file' => $this->xlsxFile([$row]),
        ], ['Accept' => 'application/json'])->assertStatus(200);

        $calon = PsbCalonSantri::where('nik', '1100000000000401')->firstOrFail();
        $this->assertStringStartsWith('PSB_', (string) $calon->no_pendaftaran);
        $this->assertEquals('baru', $calon->status_pendaftaran);
    }

    public function test_20_import_psb_nomor_duplikat_ditolak_rapi(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $row = [
            'nik' => '1100000000000411', 'nama_lengkap' => 'Import Satu', 'jk' => 'L',
            'tgl_lahir' => '2015-01-01', 'tipe_santri' => 'non_asrama', 'no_pendaftaran' => 'PSB_MANUAL_0001',
        ];
        $this->actingAs($admin, 'sanctum')->post('/api/psb/import', [
            'gelombang_id' => $f['gel']->id,
            'lembaga_id' => $f['mi']->id,
            'file' => $this->xlsxFile([$row]),
        ], ['Accept' => 'application/json'])->assertStatus(200);

        $row2 = array_merge($row, ['nik' => '1100000000000412', 'nama_lengkap' => 'Import Dua']);
        $res = $this->actingAs($admin, 'sanctum')->post('/api/psb/import', [
            'gelombang_id' => $f['gel']->id,
            'lembaga_id' => $f['mi']->id,
            'file' => $this->xlsxFile([$row2]),
        ], ['Accept' => 'application/json']);

        $res->assertStatus(422);
        $this->assertNotEmpty($res->json('errors'));
        $this->assertDatabaseMissing('psb_calon_santri', ['nik' => '1100000000000412']);
    }

    public function test_21_opsi_publik_gelombang_berdasarkan_tanggal(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta']);
        $this->makeKuota($f['gel'], $f['md'], $f['ta']);

        // Gelombang 1 & 2 ditutup (tanggal lewat) meski nomornya lebih dulu.
        $f['gel']->update([
            'tgl_buka' => now()->subDays(90)->toDateString(),
            'tgl_tutup' => now()->subDays(60)->toDateString(),
        ]);
        PsbGelombang::create([
            'psb_kegiatan_id' => $f['keg']->id, 'nomor' => 2, 'nama' => 'Gelombang Tertutup',
            'tgl_buka' => now()->subDays(90)->toDateString(),
            'tgl_tutup' => now()->subDays(60)->toDateString(),
        ]);
        // Hanya gelombang ini yang tanggalnya sedang berjalan -> dipakai publik.
        $berjalan = PsbGelombang::create([
            'psb_kegiatan_id' => $f['keg']->id, 'nomor' => 3, 'nama' => 'Gelombang Berjalan',
            'tgl_buka' => now()->subDays(30)->toDateString(),
            'tgl_tutup' => now()->addDays(30)->toDateString(),
        ]);
        $this->makeKuota($berjalan, $f['mi'], $f['ta']);
        $this->makeKuota($berjalan, $f['md'], $f['ta']);

        $res = $this->getJson('/api/psb/opsi');
        $res->assertStatus(200);
        $this->assertEquals($berjalan->id, $res->json('data.gelombang_aktif.id'));
        $this->assertEquals($f['keg']->id, $res->json('data.gelombang_aktif.kegiatan.id'));

        $lembaga = collect($res->json('data.lembaga'));
        $mi = $lembaga->firstWhere('kode', 'MI');
        $this->assertNotNull($mi);
        $this->assertEquals('1', $mi['tingkat_baru']);
        $this->assertContains('2', $mi['tingkat_pindahan']);
        $this->assertFalse($lembaga->contains('kode', 'MTS'));

        $kuota = collect($mi['kuota'])->firstWhere('tipe_santri', 'non_asrama');
        $this->assertFalse((bool) $kuota['paket_tersedia']);
        $this->assertNull($kuota['sisa_kuota']);
    }

    public function test_22_daftar_paket_simpan_bukti_transfer(): void
    {
        Storage::fake('local');
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['paket_tersedia' => true]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta']);

        $payload = $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000421', 'Paket Bukti', 'ortu21@example.com', '081422222221'
        );
        $payload['paket'] = 'MI-MD';
        $payload['bukti_transfer'] = UploadedFile::fake()->image('bukti.jpg');

        $res = $this->post('/api/psb/daftar-paket', $payload, ['Accept' => 'application/json']);
        $res->assertStatus(201);

        $calonId = $res->json('data.calon.id');
        $this->assertEquals(1, DokumenSantri::where('psb_calon_santri_id', $calonId)
            ->where('jenis_dokumen_santri', 'bukti_transfer')->count());
        $this->assertEquals(2, PsbCalonSantri::find($calonId)->lembagaDetail()->count());
    }

    public function test_23_admin_md_melihat_dan_memproses_paket(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['paket_tersedia' => true]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta']);
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);
        $adminMts = $this->makeUser('admin', [$f['mts']->id]);

        $res = $this->postJson('/api/psb/daftar-paket', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000431', 'Paket Scope', 'ortu23@example.com', '081423333331'
        ));
        $res->assertStatus(201);
        $calonId = $res->json('data.calon.id');

        $antreanMd = $this->actingAs($adminMd, 'sanctum')
            ->getJson('/api/psb/antrean-daftar-ulang?status=baru');
        $antreanMd->assertStatus(200);
        $this->assertContains($calonId, collect($antreanMd->json('data.data'))->pluck('id')->all());

        $antreanMi = $this->actingAs($adminMi, 'sanctum')
            ->getJson('/api/psb/antrean-daftar-ulang?status=baru');
        $this->assertContains($calonId, collect($antreanMi->json('data.data'))->pluck('id')->all());

        $this->actingAs($adminMd, 'sanctum')->postJson("/api/psb/{$calonId}/verifikasi")->assertStatus(200);
        $this->assertEquals('terverifikasi', PsbCalonSantri::find($calonId)->status_pendaftaran);

        $this->actingAs($adminMts, 'sanctum')->deleteJson("/api/psb/{$calonId}")->assertStatus(403);
    }

    public function test_24_kuota_pool_gabungan_mi_md(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['kuota' => 2, 'paket_tersedia' => true]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta'], ['kuota' => 99]);

        $mdSaja = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['md'], '1100000000000441', 'MD Saja', 'ortu24a@example.com', '081424444441'
        ));
        $mdSaja->assertStatus(201);
        $this->assertEquals('baru', $mdSaja->json('data.calon.status_pendaftaran'));

        $miSaja = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000442', 'MI Saja', 'ortu24b@example.com', '081424444442'
        ));
        $miSaja->assertStatus(201);
        $this->assertEquals('baru', $miSaja->json('data.calon.status_pendaftaran'));

        // Pool (kuota baris MI = 2) sudah terpakai oleh MD-saja + MI-saja -> paket waiting.
        $paket = $this->postJson('/api/psb/daftar-paket', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000443', 'Paket Penuh', 'ortu24c@example.com', '081424444443'
        ));
        $paket->assertStatus(201);
        $this->assertEquals('waiting_list', $paket->json('data.calon.status_pendaftaran'));

        // Opsi publik menampilkan sisa pool yang sama untuk MI dan MD (0).
        $opsi = $this->getJson('/api/psb/opsi');
        $lembaga = collect($opsi->json('data.lembaga'));
        $mi = $lembaga->firstWhere('kode', 'MI');
        $md = $lembaga->firstWhere('kode', 'MD');
        $this->assertEquals(0, collect($mi['kuota'])->firstWhere('tipe_santri', 'non_asrama')['sisa_kuota']);
        $this->assertEquals(0, collect($md['kuota'])->firstWhere('tipe_santri', 'non_asrama')['sisa_kuota']);
    }

    public function test_27_gelombang_otomatis_dan_tutup(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);

        $payload = $this->daftarPayload($f['gel'], $f['mi'], '1100000000000601', 'Auto Gelombang', 'ortu27@example.com', '081827777771');
        unset($payload['gelombang_id']);
        $res = $this->postJson('/api/psb/daftar', $payload);
        $res->assertStatus(201);
        $this->assertEquals($f['gel']->id, (int) PsbCalonSantri::find($res->json('data.calon.id'))->gelombang_id);

        $f['gel']->update(['tgl_tutup' => now()->subDay()->toDateString()]);
        $payload2 = $this->daftarPayload($f['gel'], $f['mi'], '1100000000000602', 'Tutup', 'ortu27b@example.com', '081827777772');
        unset($payload2['gelombang_id']);
        $this->postJson('/api/psb/daftar', $payload2)->assertStatus(422);
    }

    public function test_28_acc_santri_asrama(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false, 'tipe_santri' => 'asrama']);
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $ortu = $this->makeUser('orang_tua', [], 'ortu28@example.com', '081828888881');

        $daftar = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000611', 'Asrama Anak', 'ortu28@example.com', '081828888881',
            ['tipe_santri' => 'asrama']
        ));
        $daftar->assertStatus(201);
        $id = $daftar->json('data.calon.id');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/verifikasi")->assertStatus(200);
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/psb/{$id}/ajukan-daftar-ulang")->assertStatus(201);
        $santriId = $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/acc-daftar-ulang")->json('data.id');

        // ACC tetap membuat santri + riwayat.
        $this->assertDatabaseHas('santri', ['id' => $santriId, 'tipe_santri' => 'asrama']);
        $this->assertEquals(1, RiwayatBelajar::where('santri_id', $santriId)->where('is_aktif', true)->count());

        $daftar2 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000612', 'Non Asrama', 'ortu28b@example.com', '081828888882'
        ));
        $daftar2->assertStatus(201);
        $id2 = $daftar2->json('data.calon.id');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/verifikasi");
        $ortu2 = $this->makeUser('orang_tua', [], 'ortu28b@example.com', '081828888882');
        $this->actingAs($ortu2, 'sanctum')->postJson("/api/portal/psb/{$id2}/ajukan-daftar-ulang")->assertStatus(201);
        $santri2 = $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/acc-daftar-ulang")->json('data.id');
        $this->assertDatabaseHas('santri', ['id' => $santri2, 'tipe_santri' => 'non_asrama']);
    }

    public function test_29_kegiatan_admin_dan_anti_overlap(): void
    {
        $f = $this->baseFixture();
        $pusat = $this->makeUser('admin');
        $adminLembaga = $this->makeUser('admin', [$f['mi']->id]);

        $this->actingAs($adminLembaga, 'sanctum')->postJson('/api/admin/psb/kegiatan', [
            'tahun_ajaran_id' => $f['ta']->id, 'nama' => 'PSB X', 'is_aktif' => true,
        ])->assertStatus(403);

        // Satu tahun ajaran sudah punya kegiatan -> ditolak.
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/psb/kegiatan', [
            'tahun_ajaran_id' => $f['ta']->id, 'nama' => 'PSB Duplikat', 'is_aktif' => false,
        ])->assertStatus(422)->assertJsonValidationErrors(['tahun_ajaran_id']);

        $ta2 = TahunAjaran::create([
            'lembaga_id' => $f['mi']->id, 'nama' => '2027/2028',
            'tanggal_mulai' => '2027-07-01', 'tanggal_selesai' => '2028-06-30', 'is_aktif' => true,
        ]);
        $keg = $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/psb/kegiatan', [
            'tahun_ajaran_id' => $ta2->id, 'nama' => 'PSB 2027/2028', 'is_aktif' => true,
        ]);
        $keg->assertStatus(201);
        $kegId = $keg->json('data.id');
        $this->assertFalse((bool) PsbKegiatan::find($f['keg']->id)->is_aktif);

        $g1 = $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/psb/gelombang', [
            'psb_kegiatan_id' => $kegId, 'nama' => 'Gelombang 1',
            'tgl_buka' => '2027-01-01', 'tgl_tutup' => '2027-01-31',
        ]);
        $g1->assertStatus(201);
        $this->assertEquals(1, $g1->json('data.nomor'));

        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/psb/gelombang', [
            'psb_kegiatan_id' => $kegId, 'nama' => 'Gelombang Bentrok',
            'tgl_buka' => '2027-01-15', 'tgl_tutup' => '2027-02-15',
        ])->assertStatus(422);

        // Rentang tidak tumpang tindih -> boleh, nomor urut lanjut.
        $g2 = $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/psb/gelombang', [
            'psb_kegiatan_id' => $kegId, 'nama' => 'Gelombang 2',
            'tgl_buka' => '2027-02-01', 'tgl_tutup' => '2027-02-28',
        ]);
        $g2->assertStatus(201);
        $this->assertEquals(2, $g2->json('data.nomor'));
    }

    public function test_30_kuota_upsert_tenant(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $res = $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/psb/kuota-biaya', [
            'gelombang_id' => $f['gel']->id, 'lembaga_id' => $f['mi']->id, 'tipe_santri' => 'non_asrama',
            'kuota' => 100, 'paket_tersedia' => true,
            'membutuhkan_seleksi' => false, 'membutuhkan_pemberkasan' => true,
        ]);
        $res->assertStatus(200);
        $row = PsbKuotaBiaya::where('gelombang_id', $f['gel']->id)->where('lembaga_id', $f['mi']->id)->firstOrFail();
        $this->assertEquals(100, (int) $row->kuota);
        $this->assertTrue((bool) $row->paket_tersedia);

        $this->actingAs($adminMi, 'sanctum')->postJson('/api/admin/psb/kuota-biaya', [
            'gelombang_id' => $f['gel']->id, 'lembaga_id' => $f['md']->id, 'tipe_santri' => 'non_asrama',
        ])->assertStatus(403);

        $index = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/psb/kuota-biaya?gelombang_id='.$f['gel']->id);
        $index->assertStatus(200);
        $this->assertNotEmpty($index->json('data.rows'));
    }

    public function test_31_dokumen_per_kegiatan_checklist_santri_dan_tidak_memiliki(): void
    {
        Storage::fake('local');
        $this->seed(ReferensiSeeder::class);
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);

        // Ketentuan per kegiatan + lembaga: wajib (kk) & opsional (akta).
        foreach ([['Kartu Keluarga', true], ['Akta Kelahiran', false]] as [$jenis, $wajib]) {
            $this->actingAs($admin, 'sanctum')->postJson('/api/admin/dokumen-wajib', [
                'psb_kegiatan_id' => $f['keg']->id, 'lembaga_id' => $f['mi']->id,
                'jenis_dokumen_santri' => $jenis, 'is_wajib' => $wajib,
            ])->assertStatus(200);
        }
        $index = $this->actingAs($admin, 'sanctum')->getJson(
            "/api/admin/dokumen-wajib?psb_kegiatan_id={$f['keg']->id}&lembaga_id={$f['mi']->id}"
        );
        $index->assertStatus(200);
        $this->assertCount(2, $index->json('data'));

        // Tanpa filter lembaga: admin lembaga hanya melihat lembaganya; pusat melihat semua.
        $pusat = $this->makeUser('admin');
        $this->actingAs($pusat, 'sanctum')->postJson('/api/admin/dokumen-wajib', [
            'psb_kegiatan_id' => $f['keg']->id, 'lembaga_id' => $f['mts']->id,
            'jenis_dokumen_santri' => 'Pas Foto', 'is_wajib' => true,
        ])->assertStatus(200);

        $milikMi = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/dokumen-wajib?psb_kegiatan_id={$f['keg']->id}");
        $milikMi->assertStatus(200);
        $this->assertCount(2, $milikMi->json('data'));
        $this->assertEquals('Madrasah Ibtidaiyah', $milikMi->json('data.0.lembaga.nama'));

        $semua = $this->actingAs($pusat, 'sanctum')->getJson("/api/admin/dokumen-wajib?psb_kegiatan_id={$f['keg']->id}");
        $semua->assertStatus(200);
        $this->assertCount(3, $semua->json('data'));

        // Daftar -> verifikasi -> ajukan daftar ulang TANPA upload dokumen (tidak menahan).
        $daftar = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000701', 'Checklist Anak', 'ortu31@example.com', '083131313131'
        ));
        $daftar->assertStatus(201);
        $id = $daftar->json('data.calon.id');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/verifikasi")->assertStatus(200);

        $ortu = $this->makeUser('orang_tua', [], 'ortu31@example.com', '083131313131');
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/psb/{$id}/ajukan-daftar-ulang")->assertStatus(201);

        $santriId = $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/acc-daftar-ulang")->json('data.id');

        // Checklist otomatis (wajib & opsional) dengan file kosong.
        $rows = DokumenSantri::where('santri_id', $santriId)->get();
        $this->assertEqualsCanonicalizing(['Kartu Keluarga', 'Akta Kelahiran'], $rows->pluck('jenis_dokumen_santri')->all());
        $this->assertTrue($rows->every(fn ($r) => $r->path_file === null));

        // Upload mengisi baris placeholder, bukan menambah baris baru.
        $kk = $rows->firstWhere('jenis_dokumen_santri', 'Kartu Keluarga');
        $this->actingAs($admin, 'sanctum')->post("/api/admin/santri/{$santriId}/dokumen", [
            'jenis_dokumen_santri' => 'Kartu Keluarga',
            'file' => UploadedFile::fake()->image('kk.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(201);
        $this->assertNotNull(DokumenSantri::find($kk->id)->path_file);
        $this->assertEquals(2, DokumenSantri::where('santri_id', $santriId)->count());

        // Cek box "tidak memiliki dokumen" — tersimpan, tanpa menahan proses apa pun.
        $akta = DokumenSantri::where('santri_id', $santriId)->where('jenis_dokumen_santri', 'Akta Kelahiran')->firstOrFail();
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santriId}/dokumen/{$akta->id}/tidak-memiliki", [
            'tidak_memiliki' => true,
        ])->assertStatus(200);
        $this->assertTrue((bool) DokumenSantri::find($akta->id)->tidak_memiliki);

        $list = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/santri/{$santriId}/dokumen");
        $list->assertStatus(200);
        $this->assertCount(2, $list->json('data'));
    }

    public function test_32_masuk_daftar_ulang_oleh_admin(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false, 'membutuhkan_pemberkasan' => true]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $daftar = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000801', 'Berkas Satu', 'ortu32@example.com', '083232323232'
        ));
        $daftar->assertStatus(201);
        $id = $daftar->json('data.calon.id');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/verifikasi")->assertStatus(200);

        // Antrean menandai kebutuhan pemberkasan.
        $antrean = $this->actingAs($admin, 'sanctum')->getJson('/api/psb/antrean-daftar-ulang?status=terverifikasi');
        $row = collect($antrean->json('data.data'))->firstWhere('id', $id);
        $this->assertFalse((bool) $row['butuh_seleksi']);
        $this->assertTrue((bool) $row['butuh_pemberkasan']);

        // Jalur langsung: terverifikasi -> pemberkasan (fase daftar ulang), lalu wali ajukan.
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/daftar-ulang")
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'pemberkasan');

        $ortu = $this->makeUser('orang_tua', [], 'ortu32@example.com', '083232323232');
        $this->actingAs($ortu, 'sanctum')->postJson("/api/portal/psb/{$id}/ajukan-daftar-ulang")->assertStatus(201);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/acc-daftar-ulang")->assertStatus(201);

        // Bulk masuk daftar ulang untuk calon kedua.
        $daftar2 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000802', 'Berkas Dua', 'ortu32b@example.com', '083232323233'
        ));
        $id2 = $daftar2->json('data.calon.id');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/verifikasi")->assertStatus(200);
        $bulk = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/daftar-ulang', ['ids' => [$id2]]);
        $bulk->assertStatus(200);
        $this->assertEquals('pemberkasan', PsbCalonSantri::findOrFail($id2)->status_pendaftaran);

        // Admin boleh ACC langsung dari pemberkasan (tanpa menunggu ajuan wali).
        $acc2 = $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/acc-daftar-ulang");
        $acc2->assertStatus(201);
        $this->assertEquals('daftar_ulang', PsbCalonSantri::findOrFail($id2)->status_pendaftaran);

        // Lembaga ber-seleksi: wajib konfirmasi hasil; tanpa `lolos` ditolak.
        $this->makeKuota($f['gel'], $f['mts'], $f['ta'], ['membutuhkan_seleksi' => true]);
        $adminMts = $this->makeUser('admin', [$f['mts']->id]);
        $daftar3 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mts'], '1100000000000803', 'Uji Seleksi Gagal', 'ortu32c@example.com', '083232323234'
        ));
        $id3 = $daftar3->json('data.calon.id');
        $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$id3}/verifikasi")->assertStatus(200);
        $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$id3}/daftar-ulang")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['lolos']);
        $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$id3}/daftar-ulang", ['lolos' => false])
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'tidak_lolos');

        // Lolos seleksi -> langsung masuk fase daftar ulang.
        $daftar4 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mts'], '1100000000000804', 'Uji Seleksi Lolos', 'ortu32d@example.com', '083232323235'
        ));
        $id4 = $daftar4->json('data.calon.id');
        $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$id4}/verifikasi")->assertStatus(200);
        $this->actingAs($adminMts, 'sanctum')->postJson("/api/psb/{$id4}/daftar-ulang", ['lolos' => true])
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'pemberkasan');
    }

    public function test_33_pengunduran_diri_dari_terdaftar_daftar_ulang_dan_diterima(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $daftar = fn (string $nik, string $nama, string $email, string $telp) => $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], $nik, $nama, $email, $telp
        ))->json('data.calon.id');

        // Fase pendaftar (baru) belum boleh mengundurkan diri.
        $id0 = $daftar('1100000000000901', 'Masih Baru', 'ortu33a@example.com', '083333333331');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id0}/undur-diri")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        // Fase terdaftar: terverifikasi -> mengundurkan_diri.
        $id1 = $daftar('1100000000000902', 'Undur Terdaftar', 'ortu33b@example.com', '083333333332');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id1}/verifikasi")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id1}/undur-diri", ['catatan' => 'Alasan keluarga'])
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'mengundurkan_diri');
        $this->assertEquals('Alasan keluarga', PsbCalonSantri::findOrFail($id1)->catatan_admin);

        // Fase daftar ulang (pemberkasan) via bulk undur diri.
        $id2 = $daftar('1100000000000903', 'Undur Daftar Ulang', 'ortu33c@example.com', '083333333333');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/verifikasi")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/daftar-ulang")->assertStatus(200);
        $bulk = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/undur-diri', [
            'ids' => [$id2], 'catatan' => 'Pindah domisili',
        ]);
        $bulk->assertStatus(200);
        $this->assertEquals('mengundurkan_diri', PsbCalonSantri::findOrFail($id2)->status_pendaftaran);

        // Fase diterima (sudah ACC jadi santri) tetap bisa mengundurkan diri.
        $id3 = $daftar('1100000000000904', 'Undur Diterima', 'ortu33d@example.com', '083333333334');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id3}/verifikasi")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id3}/daftar-ulang")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id3}/acc-daftar-ulang")->assertStatus(201);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id3}/undur-diri")
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'mengundurkan_diri');
    }

    public function test_34_batalkan_fase_kembali_ke_sebelumnya(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $seq = 0;
        $daftar = function (string $nama) use ($f, &$seq) {
            $seq++;

            return $this->postJson('/api/psb/daftar', $this->daftarPayload(
                $f['gel'], $f['mi'], '1100000000001'.str_pad((string) $seq, 3, '0', STR_PAD_LEFT),
                $nama, "ortu34{$seq}@example.com", '0834343434'.str_pad((string) $seq, 2, '0', STR_PAD_LEFT),
            ))->json('data.calon.id');
        };

        // baru -> terverifikasi -> batalkan = baru.
        $id1 = $daftar('Batal Satu');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id1}/verifikasi")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id1}/batalkan-fase")
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'baru');

        // terverifikasi -> pemberkasan -> batalkan = terverifikasi.
        $id2 = $daftar('Batal Dua');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/verifikasi")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/daftar-ulang")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id2}/batalkan-fase")
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'terverifikasi');

        // undur diri (mengundurkan_diri) -> batalkan = kembali ke pemberkasan.
        $id3 = $daftar('Batal Tiga');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id3}/verifikasi")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id3}/daftar-ulang")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id3}/undur-diri")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id3}/batalkan-fase")
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'pemberkasan');

        // Fase diterima (santri sudah dibuat) tidak bisa dibatalkan.
        $id4 = $daftar('Batal Empat');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id4}/verifikasi")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id4}/daftar-ulang")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id4}/acc-daftar-ulang")->assertStatus(201);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id4}/batalkan-fase")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        // Bulk batalkan fase.
        $id5 = $daftar('Batal Lima');
        $id6 = $daftar('Batal Enam');
        foreach ([$id5, $id6] as $id) {
            $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/verifikasi")->assertStatus(200);
        }
        $bulk = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/batalkan-fase', ['ids' => [$id5, $id6]]);
        $bulk->assertStatus(200);
        $this->assertEquals('baru', PsbCalonSantri::findOrFail($id5)->status_pendaftaran);
        $this->assertEquals('baru', PsbCalonSantri::findOrFail($id6)->status_pendaftaran);
    }

    public function test_35_isi_nis_saat_acc_tunggal_dan_bulk(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $seq = 0;
        $daftar = function (string $nama) use ($f, &$seq) {
            $seq++;

            return $this->postJson('/api/psb/daftar', $this->daftarPayload(
                $f['gel'], $f['mi'], '1100000000002'.str_pad((string) $seq, 3, '0', STR_PAD_LEFT),
                $nama, "ortu35{$seq}@example.com", '0835353535'.str_pad((string) $seq, 2, '0', STR_PAD_LEFT),
            ))->json('data.calon.id');
        };
        $siapAcc = function (int $id) use ($admin) {
            $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/verifikasi")->assertStatus(200);
            $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/daftar-ulang")->assertStatus(200);
        };

        // ACC tunggal dengan NIS → santri.nis + arsip riwayat_belajar.nis terisi.
        $id1 = $daftar('Acc Nis Satu');
        $siapAcc($id1);
        $santri1 = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/psb/{$id1}/acc-daftar-ulang", ['nis' => '2400123'])
            ->assertStatus(201)
            ->json('data.id');
        $this->assertSame('2400123', LembagaSantri::where('santri_id', $santri1)->where('is_active', true)->value('nis_lokal'));

        // ACC tunggal tanpa NIS → tetap null (bisa menyusul via import).
        $id2 = $daftar('Acc Nis Dua');
        $siapAcc($id2);
        $santri2 = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/psb/{$id2}/acc-daftar-ulang")
            ->assertStatus(201)
            ->json('data.id');
        $this->assertNull(LembagaSantri::where('santri_id', $santri2)->where('is_active', true)->value('nis_lokal'));

        // Bulk ACC: NIS per calon (map id → NIS); yang kosong tetap null.
        $id3 = $daftar('Acc Nis Tiga');
        $id4 = $daftar('Acc Nis Empat');
        $siapAcc($id3);
        $siapAcc($id4);
        $bulk = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/acc-daftar-ulang', [
            'ids' => [$id3, $id4],
            'nis' => [(string) $id3 => '2400456'],
        ]);
        $bulk->assertStatus(200)->assertJsonPath('data.gagal', []);
        $this->assertSame('2400456', LembagaSantri::where('santri_id', PsbCalonSantri::findOrFail($id3)->santri_id)->where('is_active', true)->value('nis_lokal'));
        $this->assertNull(LembagaSantri::where('santri_id', PsbCalonSantri::findOrFail($id4)->santri_id)->where('is_active', true)->value('nis_lokal'));

        // Bulk: NIS panjang (16 karakter) diterima.
        $id4b = $daftar('Acc Nis Empat B');
        $siapAcc($id4b);
        $bulkPanjang = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/acc-daftar-ulang', [
            'ids' => [$id4b],
            'nis' => [(string) $id4b => '2400456000000001'],
        ]);
        $bulkPanjang->assertStatus(200)->assertJsonPath('data.gagal', []);
        $this->assertSame('2400456000000001', LembagaSantri::where('santri_id', PsbCalonSantri::findOrFail($id4b)->santri_id)->where('is_active', true)->value('nis_lokal'));

        // Validasi panjang NIS (maks 20): 21 karakter ditolak, 20 karakter diterima.
        $id5 = $daftar('Acc Nis Lima');
        $siapAcc($id5);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/psb/{$id5}/acc-daftar-ulang", ['nis' => '123456789012345678901'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nis']);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/psb/{$id5}/acc-daftar-ulang", ['nis' => '12345678901234567890'])
            ->assertStatus(201);

        // NIS wajib unik: duplikat ditolak (tunggal → 422, massal → gagal per baris).
        $id6 = $daftar('Acc Nis Enam');
        $siapAcc($id6);
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/psb/{$id6}/acc-daftar-ulang", ['nis' => '2400123'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nis']);

        $id7 = $daftar('Acc Nis Tujuh');
        $siapAcc($id7);
        $bulk2 = $this->actingAs($admin, 'sanctum')->postJson('/api/psb/bulk/acc-daftar-ulang', [
            'ids' => [$id7],
            'nis' => [(string) $id7 => '2400456'],
        ]);
        $bulk2->assertStatus(200);
        $this->assertCount(1, $bulk2->json('data.gagal'));
        $this->assertStringContainsString('NIS sudah dipakai santri lain', $bulk2->json('data.gagal.0.pesan'));
        $this->assertSame('pemberkasan', PsbCalonSantri::findOrFail($id7)->status_pendaftaran);
    }

    public function test_36_undur_dari_diterima_menghapus_santri_dan_riwayat(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $id = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000003001', 'Undur Diterima', 'ortu36@example.com', '083636363601'
        ))->json('data.calon.id');

        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/verifikasi")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/daftar-ulang")->assertStatus(200);
        $santriId = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/psb/{$id}/acc-daftar-ulang", ['nis' => '36001'])
            ->assertStatus(201)
            ->json('data.id');
        $this->assertDatabaseHas('santri', ['id' => $santriId]);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santriId, 'nis_lokal' => '36001', 'is_active' => true]);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santriId, 'kelas_id' => null, 'is_aktif' => true]);

        // Mengundurkan diri dari fase diterima → santri + riwayat ditarik kembali.
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/undur-diri", ['catatan' => 'Pindah domisili'])
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'mengundurkan_diri');

        $this->assertDatabaseMissing('santri', ['id' => $santriId]);
        $this->assertDatabaseMissing('riwayat_belajar', ['santri_id' => $santriId]);
        $this->assertDatabaseMissing('lembaga_santri', ['santri_id' => $santriId]);
        $calon = PsbCalonSantri::findOrFail($id);
        $this->assertSame('mengundurkan_diri', $calon->status_pendaftaran);
        $this->assertNull($calon->santri_id);
        // NIS kembali bebas dipakai (santri sudah tidak ada).
        $this->assertFalse(LembagaSantri::nisLokalDipakai((int) $f['mi']->id, '36001'));
    }

    public function test_37_undur_diri_diblokir_saat_santri_sudah_di_kelas(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $id = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000003701', 'Undur Berkelas', 'ortu37@example.com', '083737373701'
        ))->json('data.calon.id');

        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/verifikasi")->assertStatus(200);
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/daftar-ulang")->assertStatus(200);
        $santriId = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/psb/{$id}/acc-daftar-ulang", ['nis' => '37001'])
            ->assertStatus(201)
            ->json('data.id');

        // Penempatan kelas menyusul: riwayat aktif berisi kelas_id.
        $riwayat = RiwayatBelajar::where('santri_id', $santriId)->where('is_aktif', true)->firstOrFail();
        $kelas = Kelas::create([
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['taMi']->id, 'nama_kelas' => 'I-A',
        ]);
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/riwayat-belajar/{$riwayat->id}/set-kelas", [
            'kelas_id' => $kelas->id,
        ])->assertStatus(200);
        $this->assertEquals($kelas->id, (int) $riwayat->fresh()->kelas_id);

        // Sudah berkelas → undur diri ditolak; status calon & santri tidak berubah.
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/undur-diri")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['kelas']);
        $this->assertDatabaseHas('santri', ['id' => $santriId]);
        $this->assertSame('daftar_ulang', PsbCalonSantri::findOrFail($id)->status_pendaftaran);

        // Keluarkan dari kelas → undur diri berhasil dan santri + riwayat ditarik kembali.
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/riwayat-belajar/{$riwayat->id}/keluar-kelas")
            ->assertStatus(200);
        $this->assertNull($riwayat->fresh()->kelas_id);

        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id}/undur-diri")
            ->assertStatus(200)
            ->assertJsonPath('data.status_pendaftaran', 'mengundurkan_diri');
        $this->assertDatabaseMissing('santri', ['id' => $santriId]);
        $this->assertDatabaseMissing('riwayat_belajar', ['santri_id' => $santriId]);
        $this->assertDatabaseMissing('lembaga_santri', ['santri_id' => $santriId]);
    }

    // ---------- 38. TA se-lembaga: ACC paket menulis TA per lembaga ----------

    public function test_38_acc_paket_menulis_ta_per_lembaga(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], [
            'membutuhkan_seleksi' => false, 'paket_tersedia' => true,
        ]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        // Kegiatan menunjuk TA root; daftar tanpa TA eksplisit.
        $res = $this->postJson('/api/psb/daftar-paket', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000038', 'Paket TA', 'ortu38@example.com', '081444444438'
        ));
        $res->assertStatus(201);
        $calonId = $res->json('data.calon.id');

        // Calon mewarisi TA aktif primer (MI), bukan TA root kegiatan.
        $this->assertEquals($f['taMi']->id, (int) PsbCalonSantri::findOrFail($calonId)->tahun_ajaran_id);

        $this->actingAs($adminMi, 'sanctum')->postJson("/api/psb/{$calonId}/verifikasi")->assertStatus(200);
        $wali = $this->makeUser('orang_tua', [], 'ortu38@example.com', '081444444438');
        $this->actingAs($wali, 'sanctum')
            ->postJson("/api/portal/psb/{$calonId}/ajukan-daftar-ulang")
            ->assertStatus(201);
        DokumenSantri::create(['psb_calon_santri_id' => $calonId, 'jenis_dokumen_santri' => 'kk', 'path_file' => 'psb/dokumen/kk38.pdf']);

        $acc = $this->actingAs($adminMi, 'sanctum')->postJson("/api/psb/{$calonId}/acc-daftar-ulang");
        $acc->assertStatus(201);
        $santriId = $acc->json('data.id');

        // Riwayat MI memakai TA MI, MD memakai TA MD; tidak ada yang menunjuk root.
        $rwMi = RiwayatBelajar::where('santri_id', $santriId)->where('lembaga_id', $f['mi']->id)->firstOrFail();
        $rwMd = RiwayatBelajar::where('santri_id', $santriId)->where('lembaga_id', $f['md']->id)->firstOrFail();
        $this->assertEquals($f['taMi']->id, (int) $rwMi->tahun_ajaran_id);
        $this->assertEquals($f['taMd']->id, (int) $rwMd->tahun_ajaran_id);
        $this->assertEquals(0, RiwayatBelajar::where('santri_id', $santriId)->where('tahun_ajaran_id', $f['ta']->id)->count());
    }

    // ---------- 39. daftar satuan tanpa TA memakai TA aktif lembaganya ----------

    public function test_39_daftar_satuan_resolve_ta_aktif_lembaga(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mts'], $f['ta'], ['membutuhkan_seleksi' => false]);

        $res = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mts'], '1100000000000039', 'Satuan TA', 'ortu39@example.com', '081444444439'
        ));
        $res->assertStatus(201);
        $calonId = $res->json('data.calon.id');

        $this->assertEquals($f['taMts']->id, (int) PsbCalonSantri::findOrFail($calonId)->tahun_ajaran_id);
    }

    // ---------- 40. lembaga tanpa TA aktif ditolak sejak daftar ----------

    public function test_40_daftar_ditolak_bila_lembaga_tanpa_ta_aktif(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mts'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $f['taMts']->update(['is_aktif' => false]);

        $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mts'], '1100000000000040', 'Tanpa TA', 'ortu40@example.com', '081444444440'
        ))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['tahun_ajaran_id']);
    }

    public function test_41_daftar_lembaga_psb_tanpa_parameter_gelombang(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['tipe_santri' => 'asrama']);
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        // Pemilih lembaga di UI (mis. ketentuan dokumen) tidak boleh bergantung
        // gelombang — kegiatan baru belum punya gelombang.
        $res = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/psb/lembaga');
        $res->assertStatus(200);

        $kode = collect($res->json('data'))->pluck('kode')->all();
        $this->assertEqualsCanonicalizing(['MI', 'MD', 'MTS'], $kode);
        $this->assertTrue((bool) collect($res->json('data'))->firstWhere('kode', 'MI')['punya_asrama']);
        $this->assertFalse((bool) collect($res->json('data'))->firstWhere('kode', 'MD')['punya_asrama']);
    }
}
