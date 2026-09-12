<?php

namespace Tests\Feature;

use App\Exports\PsbTemplateExport;
use App\Models\DokumenSantri;
use App\Models\Lembaga;
use App\Models\PengajuanBiodataSantri;
use App\Models\PosKeuangan;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKuotaBiaya;
use App\Models\PsbLogStatus;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Models\WaliSantriRelasi;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
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
            'is_seleksi' => true, 'kelompok_psb' => 'eksklusif_mts', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'lembaga_id' => $root->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $gel = PsbGelombang::create([
            'tahun_ajaran_id' => $ta->id, 'nama' => 'Gelombang 1 2026/2027',
            'tgl_buka' => now()->subDays(30)->toDateString(),
            'tgl_tutup' => now()->addDays(30)->toDateString(),
            'is_aktif' => true,
        ]);
        PosKeuangan::create(['kode_pos' => 'PSB_REG', 'nama_pos' => 'Pendaftaran PSB', 'tipe' => 'sekali_bayar']);
        PosKeuangan::create(['kode_pos' => 'DFR_ULANG', 'nama_pos' => 'Daftar Ulang PSB', 'tipe' => 'sekali_bayar']);

        return compact('root', 'mi', 'md', 'mts', 'ta', 'gel');
    }

    protected function makeKuota($gel, $lembaga, $ta, array $opt = []): PsbKuotaBiaya
    {
        return PsbKuotaBiaya::create(array_merge([
            'gelombang_id' => $gel->id,
            'lembaga_id' => $lembaga->id,
            'tahun_ajaran_id' => $ta->id,
            'tipe_santri' => 'non_asrama',
            'nominal_pendaftaran' => 150000,
            'nominal_pendaftaran_lanjutan' => 50000,
            'nominal_paket' => null,
            'nominal_masuk' => 1000000,
            'kuota' => null,
            'membutuhkan_seleksi' => false,
            'membutuhkan_pemberkasan' => true,
        ], $opt));
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role, array $lembagaIds = [], ?string $email = null, ?string $phone = null): User
    {
        $this->userSeq++;
        $email = $email ?? "user{$this->userSeq}_" . uniqid() . '@example.com';
        $phone = $phone ?? '08' . str_pad((string) (9000000000 + $this->userSeq * 137 + random_int(0, 99)), 10, '0', STR_PAD_LEFT);
        // pastikan 12-14 digit unik
        $u = User::create([
            'name' => ucfirst($role) . ' ' . $this->userSeq,
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
            'tahun_ajaran_id' => $gel->tahun_ajaran_id,
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
        $posReg = PosKeuangan::where('kode_pos', 'PSB_REG')->firstOrFail();
        $this->assertDatabaseHas('tagihan', ['psb_calon_santri_id' => $calonId, 'pos_keuangan_id' => $posReg->id]);
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
            'membutuhkan_seleksi' => false, 'nominal_paket' => 250000, 'nominal_masuk' => 2000000,
        ]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta'], [
            'membutuhkan_seleksi' => false, 'nominal_masuk' => 500000,
        ]);
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);

        $nik = '1100000000000004';
        $res = $this->postJson('/api/psb/daftar-paket', $this->daftarPayload(
            $f['gel'], $f['mi'], $nik, 'Paket Anak', 'ortu4@example.com', '081444444444'
        ));
        $res->assertStatus(201);
        $primerId = $res->json('data.primer.id');
        $sekunderId = $res->json('data.sekunder.id');
        $this->assertNotEmpty($primerId);
        $this->assertNotEmpty($sekunderId);

        $primer = PsbCalonSantri::findOrFail($primerId);
        $sekunder = PsbCalonSantri::findOrFail($sekunderId);
        $this->assertNotEmpty($primer->paket_grup_id);
        $this->assertEquals($primer->paket_grup_id, $sekunder->paket_grup_id);
        $this->assertEquals($primer->no_pendaftaran, $sekunder->no_pendaftaran);
        $this->assertStringContainsString('MIMD', $primer->no_pendaftaran);
        $this->assertEquals($f['mi']->id, (int) $primer->lembaga_id);
        $this->assertEquals($f['md']->id, (int) $sekunder->lembaga_id);

        // SATU tagihan paket di primer saja
        $this->assertEquals(1, Tagihan::where('psb_calon_santri_id', $primerId)->count());
        $this->assertEquals(0, Tagihan::where('psb_calon_santri_id', $sekunderId)->count());
        $tagihanPaket = Tagihan::where('psb_calon_santri_id', $primerId)->firstOrFail();
        $this->assertEquals('MI-MD', $tagihanPaket->paket_kode);
        $this->assertEquals(250000, (float) $tagihanPaket->nominal_total);

        // accDaftarUlang satuan pada baris paket wajib ditolak (wajib accPaket).
        // Alur nyata: verifikasi grup -> ajukan per baris via portal wali -> accPaket.
        $grupAwal = $primer->paket_grup_id;
        $this->actingAs($adminMi, 'sanctum')
            ->postJson("/api/psb/paket/{$grupAwal}/verifikasi")
            ->assertStatus(200);
        $this->assertEquals('terverifikasi', PsbCalonSantri::find($primerId)->status_pendaftaran);
        $this->assertEquals('terverifikasi', PsbCalonSantri::find($sekunderId)->status_pendaftaran);
        $this->actingAs($adminMi, 'sanctum')
            ->postJson("/api/psb/{$primerId}/acc-daftar-ulang")
            ->assertStatus(422);

        $wali = $this->makeUser('orang_tua', [], 'ortu4@example.com', '081444444444');
        foreach ([$primerId, $sekunderId] as $cid) {
            $this->actingAs($wali, 'sanctum')
                ->postJson("/api/portal/psb/{$cid}/ajukan-daftar-ulang")
                ->assertStatus(201);
        }

        // dokumen pindah (buat langsung via DB, hindari upload)
        DokumenSantri::create(['psb_calon_santri_id' => $primerId, 'jenis_dokumen_santri' => 'kk', 'path_file' => 'psb/dokumen/kk1.pdf']);
        DokumenSantri::create(['psb_calon_santri_id' => $sekunderId, 'jenis_dokumen_santri' => 'kk', 'path_file' => 'psb/dokumen/kk2.pdf']);

        // ACC paket tunggal
        $grup = $primer->paket_grup_id;
        $acc = $this->actingAs($adminMi, 'sanctum')->postJson("/api/psb/paket/{$grup}/acc");
        $acc->assertStatus(201);
        $santriId = $acc->json('data.id');
        $this->assertNotEmpty($santriId);

        $this->assertEquals(1, Santri::where('id', $santriId)->count());
        // 2 riwayat aktif (MI + MD)
        $this->assertEquals(2, RiwayatBelajar::where('santri_id', $santriId)->where('is_aktif', true)->count());
        $this->assertEquals(1, RiwayatBelajar::where('santri_id', $santriId)->where('lembaga_id', $f['mi']->id)->count());
        $this->assertEquals(1, RiwayatBelajar::where('santri_id', $santriId)->where('lembaga_id', $f['md']->id)->count());
        // tagihan masuk primer saja
        $posMasuk = PosKeuangan::where('kode_pos', 'DFR_ULANG')->firstOrFail();
        $masuk = Tagihan::where('santri_id', $santriId)->where('pos_keuangan_id', $posMasuk->id)->get();
        $this->assertEquals(1, $masuk->count());
        $this->assertEquals($f['mi']->id, (int) $masuk->first()->lembaga_id);
        // dokumen pindah ke santri
        $this->assertEquals(2, DokumenSantri::where('santri_id', $santriId)->count());
        $this->assertEquals(0, DokumenSantri::whereIn('psb_calon_santri_id', [$primerId, $sekunderId])->count());
        // kedua baris daftar_ulang
        $this->assertEquals('daftar_ulang', PsbCalonSantri::find($primerId)->status_pendaftaran);
        $this->assertEquals('daftar_ulang', PsbCalonSantri::find($sekunderId)->status_pendaftaran);
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
        $posMasuk = PosKeuangan::where('kode_pos', 'DFR_ULANG')->firstOrFail();
        $this->assertDatabaseHas('tagihan', ['santri_id' => $santriId, 'pos_keuangan_id' => $posMasuk->id]);
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

    // ---------- 7. tolak satuan + paket atomik ----------

    public function test_07_tolak_satuan_dan_paket_atomik(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], [
            'membutuhkan_seleksi' => false, 'nominal_paket' => 250000,
        ]);
        $this->makeKuota($f['gel'], $f['md'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        // satuan
        $d1 = $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000007', 'Tolak Satu', 'ortu7a@example.com', '081777777771'
        ))->json('data.calon.id');
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$d1}/tolak", ['catatan' => 'berkas kurang'])
            ->assertStatus(200);
        $this->assertEquals('ditolak', PsbCalonSantri::find($d1)->status_pendaftaran);

        // paket: tolak satuan wajib 422, tolakPaket atomik 2 baris
        $paket = $this->postJson('/api/psb/daftar-paket', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000008', 'Tolak Paket', 'ortu7b@example.com', '081777777772'
        ));
        $paket->assertStatus(201);
        $p1 = $paket->json('data.primer.id');
        $p2 = $paket->json('data.sekunder.id');
        $grup = PsbCalonSantri::find($p1)->paket_grup_id;

        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$p1}/tolak")->assertStatus(422);

        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/paket/{$grup}/tolak", ['catatan' => 'batal'])
            ->assertStatus(200);
        $this->assertEquals('ditolak', PsbCalonSantri::find($p1)->status_pendaftaran);
        $this->assertEquals('ditolak', PsbCalonSantri::find($p2)->status_pendaftaran);
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

        // longgarkan: tolak pendaftar pertama
        $this->actingAs($admin, 'sanctum')->postJson("/api/psb/{$id1}/tolak")->assertStatus(200);

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
        $this->assertEquals('3', PsbCalonSantri::find($calonId)->masuk_tingkat);

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
                $f['gel'], $f['mi'], $nik, $nama, "ortu13{$i}@example.com", '0813000000' . $i
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
    }

    // ---------- 15. jalur publik dilarang memakai santri_asal_id (IDOR) ----------

    public function test_15_daftar_publik_menolak_santri_asal_id(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false, 'nominal_paket' => 250000]);
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

    // ---------- 17. gelombang nonaktif ditolak ----------

    public function test_17_gelombang_nonaktif_ditolak(): void
    {
        $f = $this->baseFixture();
        $this->makeKuota($f['gel'], $f['mi'], $f['ta'], ['membutuhkan_seleksi' => false]);
        $f['gel']->update(['is_aktif' => false]);

        $this->postJson('/api/psb/daftar', $this->daftarPayload(
            $f['gel'], $f['mi'], '1100000000000321', 'Gelombang Mati', 'ortu17@example.com', '081717171717'
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
        $headings = (new PsbTemplateExport())->headings();
        $data = [$headings];
        foreach ($rows as $row) {
            $data[] = array_map(fn ($h) => $row[$h] ?? '', $headings);
        }

        $spreadsheet = new Spreadsheet();
        $spreadsheet->getActiveSheet()->fromArray($data, null, 'A1');
        $path = tempnam(sys_get_temp_dir(), 'psbimport') . '.xlsx';
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
}
