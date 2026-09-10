<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use App\Services\SiklusSantriService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SiklusFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->ensureRefs();
    }

    // ---------- helpers ----------

    /**
     * Minimal global refs agar validasi RefService lolos di sqlite.
     * Cermin ReferensiSeeder (no.51 + 'kenaikan' v1.7.1); disisip manual
     * karena test tidak menjalankan seeder ref.
     */
    protected function ensureRefs(): void
    {
        foreach ([
            ['kode' => 'santri_baru', 'label' => 'Santri Baru'],
            ['kode' => 'mengulang', 'label' => 'Mengulang'],
            ['kode' => 'pindahan', 'label' => 'Pindahan'],
            ['kode' => 'kenaikan', 'label' => 'Kenaikan Kelas'],
        ] as $i => $r) {
            DB::table('ref_status_awal')->updateOrInsert(
                ['lembaga_id' => null, 'kode' => $r['kode']],
                ['label' => $r['label'], 'urutan' => $i, 'is_active' => true]
            );
        }
        foreach ([
            ['kode' => 'aktif', 'label' => 'Aktif'],
            ['kode' => 'naik', 'label' => 'Naik'],
            ['kode' => 'tidak_naik', 'label' => 'Tidak Naik'],
            ['kode' => 'pindah_keluar', 'label' => 'Pindah/Keluar'],
            ['kode' => 'lulus', 'label' => 'Lulus'],
            ['kode' => 'tidak_lulus', 'label' => 'Tidak Lulus'],
        ] as $i => $r) {
            DB::table('ref_status_akhir')->updateOrInsert(
                ['lembaga_id' => null, 'kode' => $r['kode']],
                ['label' => $r['label'], 'is_aktif_bawaan' => $r['kode'] === 'aktif', 'terminal_ke' => null, 'urutan' => $i, 'is_active' => true]
            );
        }
        foreach (['Ikut pindah orang tua', 'Lainnya'] as $i => $nama) {
            DB::table('ref_alasan_mutasi')->updateOrInsert(
                ['lembaga_id' => null, 'nama' => $nama],
                ['urutan' => $i, 'is_active' => true]
            );
        }
        Cache::flush();
    }

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
        $taLama = TahunAjaran::create([
            'lembaga_id' => $root->id, 'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => false,
        ]);
        $taBaru = TahunAjaran::create([
            'lembaga_id' => $root->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        return compact('root', 'mi', 'md', 'mts', 'taLama', 'taBaru');
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->userSeq,
            'email' => "siklus102_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9200000000 + $this->userSeq * 137 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
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

    protected function makeSantri(Lembaga $primer, string $nama): Santri
    {
        $this->santriSeq++;

        return Santri::create([
            'lembaga_id' => $primer->id,
            'nama_lengkap' => $nama.' '.$this->santriSeq,
            'jk' => 'L',
            'status_global' => true,
        ]);
    }

    protected function makeKelas(Lembaga $lembaga, TahunAjaran $ta, string $nama, ?string $tingkat = null): Kelas
    {
        return Kelas::create([
            'lembaga_id' => $lembaga->id,
            'tahun_ajaran_id' => $ta->id,
            'nama_kelas' => $nama.'-'.uniqid(),
            'tingkat' => $tingkat,
        ]);
    }

    protected function makeRiwayat(Santri $santri, TahunAjaran $ta, Lembaga $lembaga, string $semester, array $opt = []): RiwayatBelajar
    {
        return RiwayatBelajar::create(array_merge([
            'santri_id' => $santri->id,
            'tahun_ajaran_id' => $ta->id,
            'lembaga_id' => $lembaga->id,
            'kelas_id' => null,
            'semester' => $semester,
            'tgl_masuk' => '2025-07-15',
            'tingkat' => null,
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
            'is_aktif' => true,
        ], $opt));
    }

    protected function mutasiPayload(Lembaga $lembaga, Kelas $kelasAkhir, string $alasan = 'Ikut pindah orang tua'): array
    {
        return [
            'lembaga_id' => $lembaga->id,
            'kelas_terakhir_id' => $kelasAkhir->id,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => $alasan,
        ];
    }

    protected function lulusPayload(Lembaga $lembaga, TahunAjaran $taLulus): array
    {
        return [
            'lembaga_id' => $lembaga->id,
            'tahun_ajaran_lulus_id' => $taLulus->id,
            'tanggal_lulus' => '2026-06-15',
        ];
    }

    // ---------- 1. naik massal partial + set-kelas ----------

    public function test_01_naik_massal_partial_dan_set_kelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);

        $kelasLama = $this->makeKelas($f['mi'], $f['taLama'], 'II-A', '2');

        $sValid = $this->makeSantri($f['mi'], 'Naik Valid');
        $rLama = $this->makeRiwayat($sValid, $f['taLama'], $f['mi'], '2', [
            'kelas_id' => $kelasLama->id, 'tingkat' => '2',
            'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_aktif' => true,
        ]);

        // Invalid: tanpa riwayat aktif sama sekali.
        $sInvalid = $this->makeSantri($f['mi'], 'Naik Invalid');

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_baru_id' => $f['taBaru']->id,
            'tingkat' => '3',
            'siswa' => [
                ['santri_id' => $sValid->id, 'status' => 'naik'],
                ['santri_id' => $sInvalid->id, 'status' => 'naik'],
            ],
        ]);

        $res->assertStatus(200);
        $res->assertJsonPath('berhasil', 1);
        $this->assertCount(1, $res->json('gagal'));
        $this->assertEquals($sInvalid->id, $res->json('gagal.0.santri_id'));

        // Lama ditutup, baru kelas_id null menunggu penempatan.
        $this->assertEquals('naik', $rLama->fresh()->status_akhir);
        $this->assertFalse((bool) $rLama->fresh()->is_aktif);

        $baru = RiwayatBelajar::where('santri_id', $sValid->id)
            ->where('tahun_ajaran_id', $f['taBaru']->id)
            ->where('lembaga_id', $f['mi']->id)
            ->where('semester', '1')->firstOrFail();
        $this->assertNull($baru->kelas_id);
        $this->assertTrue((bool) $baru->is_aktif);
        $this->assertEquals('kenaikan', $baru->status_awal);
        $this->assertEquals('aktif', $baru->status_akhir);
        $this->assertEquals('3', $baru->tingkat);

        // Penempatan menyusul via set-kelas.
        $kelasBaru = $this->makeKelas($f['mi'], $f['taBaru'], 'III-A', '3');
        $set = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/riwayat/{$baru->id}/set-kelas",
            ['kelas_id' => $kelasBaru->id]
        );
        $set->assertStatus(200);
        $this->assertEquals($kelasBaru->id, (int) $set->json('data.kelas_id'));
        $this->assertEquals($kelasBaru->id, (int) $baru->fresh()->kelas_id);
    }

    // ---------- 2. salin ganjil→genap via service ----------

    public function test_02_salin_ganjil_ke_genap_via_service(): void
    {
        $f = $this->baseFixture();
        $s = $this->makeSantri($f['mi'], 'Salin Anak');
        $kelasGanjil = $this->makeKelas($f['mi'], $f['taLama'], 'I-A', '1');
        $ganjil = $this->makeRiwayat($s, $f['taLama'], $f['mi'], '1', [
            'kelas_id' => $kelasGanjil->id, 'tingkat' => '1',
            'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_aktif' => true,
        ]);

        $svc = app(SiklusSantriService::class);
        $genap = $svc->salinKeGenap($s, $f['mi']->id, '2026-01-10');

        // Ganjil arsip (pengecualian invarian: status_akhir tetap aktif, is_aktif false).
        $this->assertFalse((bool) $ganjil->fresh()->is_aktif);
        $this->assertEquals('aktif', $ganjil->fresh()->status_akhir);

        // Genap aktif copy.
        $this->assertEquals('2', $genap->semester);
        $this->assertEquals($f['taLama']->id, (int) $genap->tahun_ajaran_id);
        $this->assertEquals($f['mi']->id, (int) $genap->lembaga_id);
        $this->assertTrue((bool) $genap->is_aktif);
        $this->assertEquals('aktif', $genap->status_akhir);
        $this->assertEquals($ganjil->status_awal, $genap->status_awal);
        $this->assertEquals($ganjil->kelas_id, $genap->kelas_id);
        $this->assertEquals($ganjil->tingkat, $genap->tingkat);

        // 1 aktif per santri-lembaga terjaga.
        $this->assertEquals(1, RiwayatBelajar::where('santri_id', $s->id)
            ->where('lembaga_id', $f['mi']->id)->where('is_aktif', true)->count());
    }

    // ---------- 3. pindah/set-kelas validasi ----------

    public function test_03_pindah_set_kelas_validasi_lembaga_tahun_tingkat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);

        $s = $this->makeSantri($f['mi'], 'Pindah Anak');
        $kelasA = $this->makeKelas($f['mi'], $f['taLama'], 'II-A', '2');
        $riwayat = $this->makeRiwayat($s, $f['taLama'], $f['mi'], '1', [
            'kelas_id' => $kelasA->id, 'tingkat' => '2', 'is_aktif' => true,
        ]);

        // Beda lembaga → 422.
        $kelasBedaLembaga = $this->makeKelas($f['md'], $f['taLama'], 'II-MD', '2');
        $r1 = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/riwayat/{$riwayat->id}/pindah-kelas",
            ['kelas_baru_id' => $kelasBedaLembaga->id]
        );
        $r1->assertStatus(422);

        // Beda tahun → 422.
        $kelasBedaTahun = $this->makeKelas($f['mi'], $f['taBaru'], 'II-B', '2');
        $r2 = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/riwayat/{$riwayat->id}/pindah-kelas",
            ['kelas_baru_id' => $kelasBedaTahun->id]
        );
        $r2->assertStatus(422);

        // Beda tingkat → 422 (via set-kelas, alias validasi sama).
        $kelasBedaTingkat = $this->makeKelas($f['mi'], $f['taLama'], 'III-A', '3');
        $r3 = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/riwayat/{$riwayat->id}/set-kelas",
            ['kelas_id' => $kelasBedaTingkat->id]
        );
        $r3->assertStatus(422);

        // Riwayat tidak berubah oleh 3 penolakan.
        $this->assertEquals($kelasA->id, (int) $riwayat->fresh()->kelas_id);
    }

    // ---------- 4. mutasi per lembaga (paket) ----------

    public function test_04_mutasi_per_lembaga_paket(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);

        $s = $this->makeSantri($f['mi'], 'Paket Mutasi');
        $rMi = $this->makeRiwayat($s, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $rMd = $this->makeRiwayat($s, $f['taLama'], $f['md'], '1', ['is_aktif' => true]);
        $kelasMd = $this->makeKelas($f['md'], $f['taLama'], 'I-MD', '1');

        $res = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/santri/{$s->id}/mutasi",
            $this->mutasiPayload($f['md'], $kelasMd)
        );
        $res->assertStatus(200);

        $this->assertFalse((bool) $rMd->fresh()->is_aktif);
        $this->assertEquals('pindah_keluar', $rMd->fresh()->status_akhir);
        $this->assertTrue((bool) $rMi->fresh()->is_aktif);
        $this->assertTrue((bool) $s->fresh()->status_global);
        $this->assertDatabaseHas('mutasi_keluar', [
            'santri_id' => $s->id, 'lembaga_id' => $f['md']->id,
        ]);
    }

    // ---------- 5. mutasi tanpa riwayat aktif → 422 ----------

    public function test_05_mutasi_tanpa_riwayat_aktif_422(): void
    {
        $f = $this->baseFixture();
        // super_admin agar sampai ke validasi service (bukan 403 tenant).
        $admin = $this->makeUser('super_admin', []);

        $s = $this->makeSantri($f['mi'], 'Tanpa Riwayat MD');
        $this->makeRiwayat($s, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $kelasMd = $this->makeKelas($f['md'], $f['taLama'], 'I-MD', '1');

        $res = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/santri/{$s->id}/mutasi",
            $this->mutasiPayload($f['md'], $kelasMd)
        );
        $res->assertStatus(422);
        $this->assertDatabaseMissing('mutasi_keluar', [
            'santri_id' => $s->id, 'lembaga_id' => $f['md']->id,
        ]);
    }

    // ---------- 6. lulus → alumni + status_global ----------

    public function test_06_lulus_alumni_dan_status_global_last_wins(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);

        $s = $this->makeSantri($f['mi'], 'Paket Lulus');
        $rMi = $this->makeRiwayat($s, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $rMd = $this->makeRiwayat($s, $f['taLama'], $f['md'], '1', ['is_aktif' => true]);

        // Lulus MI dulu: MI non-aktif, MD jalan terus, global tetap true.
        $l1 = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/santri/{$s->id}/lulus",
            $this->lulusPayload($f['mi'], $f['taLama'])
        );
        $l1->assertStatus(200);
        $this->assertFalse((bool) $rMi->fresh()->is_aktif);
        $this->assertEquals('lulus', $rMi->fresh()->status_akhir);
        $this->assertTrue((bool) $rMd->fresh()->is_aktif);
        $this->assertTrue((bool) $s->fresh()->status_global);
        $this->assertDatabaseHas('alumni', [
            'santri_id' => $s->id, 'lembaga_lulus_id' => $f['mi']->id,
        ]);

        // Lulus MD (jenjang terakhir): semua non-aktif → global false, alumni last-wins MD.
        $l2 = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/santri/{$s->id}/lulus",
            $this->lulusPayload($f['md'], $f['taLama'])
        );
        $l2->assertStatus(200);
        $this->assertFalse((bool) $rMd->fresh()->is_aktif);
        $this->assertFalse((bool) $s->fresh()->status_global);
        $this->assertEquals(1, Alumni::where('santri_id', $s->id)->count());
        $this->assertEquals($f['md']->id, (int) Alumni::where('santri_id', $s->id)->firstOrFail()->lembaga_lulus_id);
    }

    // ---------- 7. berhenti-jenjang paket ----------

    public function test_07_berhenti_jenjang_paket_dan_recalc(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);

        $s = $this->makeSantri($f['mi'], 'Paket Berhenti');
        $rMi = $this->makeRiwayat($s, $f['taLama'], $f['mi'], '1', ['is_aktif' => true, 'status_akhir' => 'aktif']);
        $rMd = $this->makeRiwayat($s, $f['taLama'], $f['md'], '1', ['is_aktif' => true, 'status_akhir' => 'aktif']);

        $b1 = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/santri/{$s->id}/berhenti-jenjang",
            ['lembaga_id' => $f['md']->id]
        );
        $b1->assertStatus(200);
        $this->assertFalse((bool) $rMd->fresh()->is_aktif);
        // Pengecualian invarian: status_akhir dipertahankan arsip.
        $this->assertEquals('aktif', $rMd->fresh()->status_akhir);
        $this->assertTrue((bool) $rMi->fresh()->is_aktif);
        $this->assertTrue((bool) $s->fresh()->status_global);

        $b2 = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/santri/{$s->id}/berhenti-jenjang",
            ['lembaga_id' => $f['mi']->id]
        );
        $b2->assertStatus(200);
        $this->assertFalse((bool) $rMi->fresh()->is_aktif);
        $this->assertFalse((bool) $s->fresh()->status_global);
    }

    // ---------- 8. tenant per-lembaga ----------

    public function test_08_tenant_md_only_mutasi_lulus_200_mi_403_luar_403(): void
    {
        $f = $this->baseFixture();
        $adminMd = $this->makeUser('admin', [$f['md']->id]);
        $adminLuar = $this->makeUser('admin', [$f['mts']->id]);

        // Santri-1 paket untuk mutasi MD oleh admin MD (primer MI, gerbang target).
        $s1 = $this->makeSantri($f['mi'], 'Tenant Mutasi');
        $this->makeRiwayat($s1, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $this->makeRiwayat($s1, $f['taLama'], $f['md'], '1', ['is_aktif' => true]);
        $kelasMd1 = $this->makeKelas($f['md'], $f['taLama'], 'I-MD', '1');

        $this->actingAs($adminMd, 'sanctum')->postJson(
            "/api/admin/santri/{$s1->id}/mutasi",
            $this->mutasiPayload($f['md'], $kelasMd1)
        )->assertStatus(200);

        // Santri-2 paket untuk lulus MD oleh admin MD.
        $s2 = $this->makeSantri($f['mi'], 'Tenant Lulus');
        $this->makeRiwayat($s2, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $rMd2 = $this->makeRiwayat($s2, $f['taLama'], $f['md'], '1', ['is_aktif' => true]);

        $this->actingAs($adminMd, 'sanctum')->postJson(
            "/api/admin/santri/{$s2->id}/lulus",
            $this->lulusPayload($f['md'], $f['taLama'])
        )->assertStatus(200);
        $this->assertFalse((bool) $rMd2->fresh()->is_aktif);

        // Santri-3 paket segar untuk penolakan.
        $s3 = $this->makeSantri($f['mi'], 'Tenant Tolak');
        $this->makeRiwayat($s3, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $this->makeRiwayat($s3, $f['taLama'], $f['md'], '1', ['is_aktif' => true]);
        $kelasMi3 = $this->makeKelas($f['mi'], $f['taLama'], 'I-MI', '1');
        $kelasMd3 = $this->makeKelas($f['md'], $f['taLama'], 'I-MD', '1');

        // Admin MD-only sentuh baris MI → 403.
        $this->actingAs($adminMd, 'sanctum')->postJson(
            "/api/admin/santri/{$s3->id}/mutasi",
            $this->mutasiPayload($f['mi'], $kelasMi3)
        )->assertStatus(403);
        $this->actingAs($adminMd, 'sanctum')->postJson(
            "/api/admin/santri/{$s3->id}/berhenti-jenjang",
            ['lembaga_id' => $f['mi']->id]
        )->assertStatus(403);

        // Admin luar (MTS-only) sentuh MD → 403.
        $this->actingAs($adminLuar, 'sanctum')->postJson(
            "/api/admin/santri/{$s3->id}/mutasi",
            $this->mutasiPayload($f['md'], $kelasMd3)
        )->assertStatus(403);
        $this->actingAs($adminLuar, 'sanctum')->postJson(
            "/api/admin/santri/{$s3->id}/lulus",
            $this->lulusPayload($f['md'], $f['taLama'])
        )->assertStatus(403);
    }

    // ---------- 9. list mutasi/alumni terskop tenant ----------

    public function test_09_list_mutasi_alumni_terskop_tenant(): void
    {
        $f = $this->baseFixture();
        $super = $this->makeUser('super_admin', []);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);

        // Mutasi MI vs MD.
        $sMi = $this->makeSantri($f['mi'], 'List MI');
        $this->makeRiwayat($sMi, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $kelasMi = $this->makeKelas($f['mi'], $f['taLama'], 'I-MI', '1');
        $this->actingAs($super, 'sanctum')->postJson(
            "/api/admin/santri/{$sMi->id}/mutasi",
            $this->mutasiPayload($f['mi'], $kelasMi)
        )->assertStatus(200);

        $sMd = $this->makeSantri($f['mi'], 'List MD');
        $this->makeRiwayat($sMd, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $this->makeRiwayat($sMd, $f['taLama'], $f['md'], '1', ['is_aktif' => true]);
        $kelasMd = $this->makeKelas($f['md'], $f['taLama'], 'I-MD', '1');
        $this->actingAs($super, 'sanctum')->postJson(
            "/api/admin/santri/{$sMd->id}/mutasi",
            $this->mutasiPayload($f['md'], $kelasMd)
        )->assertStatus(200);

        // Alumni MI vs MD (santri berbeda karena unique santri_id).
        $sAlMi = $this->makeSantri($f['mi'], 'Alumni MI');
        $this->makeRiwayat($sAlMi, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $this->actingAs($super, 'sanctum')->postJson(
            "/api/admin/santri/{$sAlMi->id}/lulus",
            $this->lulusPayload($f['mi'], $f['taLama'])
        )->assertStatus(200);

        $sAlMd = $this->makeSantri($f['mi'], 'Alumni MD');
        $this->makeRiwayat($sAlMd, $f['taLama'], $f['mi'], '1', ['is_aktif' => true]);
        $this->makeRiwayat($sAlMd, $f['taLama'], $f['md'], '1', ['is_aktif' => true]);
        $this->actingAs($super, 'sanctum')->postJson(
            "/api/admin/santri/{$sAlMd->id}/lulus",
            $this->lulusPayload($f['md'], $f['taLama'])
        )->assertStatus(200);

        // Admin MD-only hanya melihat baris MD.
        $lm = $this->actingAs($adminMd, 'sanctum')->getJson('/api/admin/mutasi-keluar');
        $lm->assertStatus(200);
        $idsMutasi = collect($lm->json('data'))->pluck('santri_id')->all();
        $this->assertContains($sMd->id, $idsMutasi);
        $this->assertNotContains($sMi->id, $idsMutasi);

        $la = $this->actingAs($adminMd, 'sanctum')->getJson('/api/admin/alumni');
        $la->assertStatus(200);
        $idsAlumni = collect($la->json('data'))->pluck('santri_id')->all();
        $this->assertContains($sAlMd->id, $idsAlumni);
        $this->assertNotContains($sAlMi->id, $idsAlumni);
    }

    // ---------- 10. tidak lulus -> baris tapel-berikut mengulang ----------

    public function test_10_tidak_lulus_buka_baris_mengulang(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);

        // TA berikut di lembaga yang sama (MI).
        $taA = TahunAjaran::create([
            'lembaga_id' => $f['mi']->id, 'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => false,
        ]);
        $taB = TahunAjaran::create([
            'lembaga_id' => $f['mi']->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $s = $this->makeSantri($f['mi'], 'Tidak Lulus');
        $this->makeRiwayat($s, $taA, $f['mi'], '2', ['tingkat' => '3']);

        $res = $this->actingAs($admin, 'sanctum')->postJson(
            "/api/admin/santri/{$s->id}/lulus",
            array_merge($this->lulusPayload($f['mi'], $taA), ['hasil' => 'tidak_lulus'])
        );
        $res->assertStatus(200);
        $this->assertEquals('mengulang', $res->json('data.status_awal'));

        // Baris lama tutup tidak_lulus; baris baru aktif mengulang tingkat sama.
        $lama = RiwayatBelajar::where('santri_id', $s->id)
            ->where('tahun_ajaran_id', $taA->id)->firstOrFail();
        $this->assertEquals('tidak_lulus', $lama->status_akhir);
        $this->assertFalse((bool) $lama->is_aktif);
        $baru = RiwayatBelajar::where('santri_id', $s->id)
            ->where('tahun_ajaran_id', $taB->id)->firstOrFail();
        $this->assertEquals('mengulang', $baru->status_awal);
        $this->assertEquals('3', $baru->tingkat);
        $this->assertTrue((bool) $baru->is_aktif);
        $this->assertTrue((bool) $s->fresh()->status_global);
        // Tanpa baris alumni (alumni hanya untuk lulusan).
        $this->assertEquals(0, Alumni::where('santri_id', $s->id)->count());
    }
}

/*
DAFTAR PENYIMPANGAN / ISSUE (SiklusFlowTest):
1. SELESAI v1.7.1: status_awal naik = 'kenaikan' (bukan 'naik_kelas' no.19 yang
   dicabut no.51); mutasi/lulus pakai 'pindah_keluar' selaras seeder+migration.
2. Gerbang tenant controller = canAccess(target) + riwayat-aktif-di-target
   (authorizeAksiLembaga), BUKAN policy primer — admin sekunder paket sah memproses
   baris lembaganya. SantriPolicy::mutasi tetap ada untuk kompatibilitas.
*/
