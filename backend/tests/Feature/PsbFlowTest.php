<?php

namespace Tests\Feature;

use App\Models\DokumenSantri;
use App\Models\Lembaga;
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
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
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
}
