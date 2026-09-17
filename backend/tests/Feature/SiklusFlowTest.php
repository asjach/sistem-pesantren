<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Alur siklus akademik (model baru):
 * salin genap → kenaikan → kelulusan / tidak lulus / mutasi keluar / berhenti jenjang,
 * dengan `riwayat_belajar` sebagai sumber kebenaran dan `lembaga_santri` sebagai keanggotaan.
 */
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

    protected function ensureRefs(): void
    {
        foreach ([
            ['kode' => 'santri_baru', 'nama' => 'Santri Baru'],
            ['kode' => 'mengulang', 'nama' => 'Mengulang'],
            ['kode' => 'pindahan', 'nama' => 'Pindahan'],
            ['kode' => 'kenaikan', 'nama' => 'Kenaikan Kelas'],
        ] as $i => $r) {
            DB::table('ref_status_awal')->updateOrInsert(
                ['lembaga_id' => null, 'kode' => $r['kode']],
                ['nama' => $r['nama'], 'urutan' => $i, 'is_active' => true]
            );
        }
        foreach ([
            ['kode' => 'aktif', 'nama' => 'Aktif'],
            ['kode' => 'naik', 'nama' => 'Naik'],
            ['kode' => 'tidak_naik', 'nama' => 'Tidak Naik'],
            ['kode' => 'pindah_keluar', 'nama' => 'Pindah/Keluar'],
            ['kode' => 'lulus', 'nama' => 'Lulus'],
            ['kode' => 'tidak_lulus', 'nama' => 'Tidak Lulus'],
        ] as $i => $r) {
            DB::table('ref_status_akhir')->updateOrInsert(
                ['lembaga_id' => null, 'kode' => $r['kode']],
                ['nama' => $r['nama'], 'is_aktif_bawaan' => $r['kode'] === 'aktif', 'terminal_ke' => null, 'urutan' => $i, 'is_active' => true]
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
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI', 'nsm' => '123456789012',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD', 'nsm' => '123456789013',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $taLama = TahunAjaran::create([
            'lembaga_id' => $mi->id, 'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => false,
        ]);
        $taBaru = TahunAjaran::create([
            'lembaga_id' => $mi->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMd = TahunAjaran::create([
            'lembaga_id' => $md->id, 'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => true,
        ]);

        return compact('root', 'mi', 'md', 'taLama', 'taBaru', 'taMd');
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

    protected function makeSantri(string $nama): Santri
    {
        $this->santriSeq++;

        return Santri::create([
            'nama_lengkap' => $nama.' '.$this->santriSeq,
            'jk' => 'L',
        ]);
    }

    protected function makeKeanggotaan(Santri $santri, Lembaga $lembaga, ?string $nisLokal = null, bool $aktif = true): LembagaSantri
    {
        return LembagaSantri::create([
            'santri_id' => $santri->id,
            'lembaga_id' => $lembaga->id,
            'nis_lokal' => $nisLokal,
            'is_active' => $aktif,
            'tgl_mulai' => '2025-07-01',
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
            'tingkat' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
            'is_aktif' => true,
        ], $opt));
    }

    // ---------- 01. salin genap massal ----------

    public function test_01_salin_genap_massal_api(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $santri = $this->makeSantri('Ganjil Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25001');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '1A', '1');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelas->id]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'lembaga_id' => $f['mi']->id,
            'tanggal_masuk' => '2026-01-05',
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('berhasil'));
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran_id' => $f['taLama']->id,
            'semester' => '2', 'kelas_id' => $kelas->id, 'is_aktif' => true,
        ]);
        $this->assertFalse((bool) RiwayatBelajar::where('santri_id', $santri->id)->where('semester', '1')->firstOrFail()->is_aktif);

        // Salin ulang baris yang ganjilnya sudah tertutup → per-item gagal (partial), bukan 500.
        $res2 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'lembaga_id' => $f['mi']->id,
            'tanggal_masuk' => '2026-01-05',
            'siswa' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);
        $this->assertSame(0, $res2->json('berhasil'));
        $this->assertCount(1, $res2->json('gagal'));
    }

    // ---------- 02. kenaikan massal naik/tidak naik ----------

    public function test_02_naik_kelas_massal_naik_dan_tidak_naik(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);

        $naikSantri = $this->makeSantri('Naik Satu');
        $this->makeKeanggotaan($naikSantri, $f['mi'], '25002');
        $this->makeRiwayat($naikSantri, $f['taLama'], $f['mi'], '2', ['tingkat' => '1']);

        $tinggalSantri = $this->makeSantri('Tinggal Satu');
        $this->makeKeanggotaan($tinggalSantri, $f['mi'], '25003');
        $this->makeRiwayat($tinggalSantri, $f['taLama'], $f['mi'], '2', ['tingkat' => '1']);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_baru_id' => $f['taBaru']->id,
            'tingkat' => '2',
            'siswa' => [
                ['santri_id' => $naikSantri->id, 'status' => 'naik'],
                ['santri_id' => $tinggalSantri->id, 'status' => 'tidak_naik'],
            ],
        ])->assertStatus(200);

        $this->assertSame(2, $res->json('berhasil'));

        // Baris lama ditutup dengan hasil masing-masing.
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $naikSantri->id, 'semester' => '2', 'status_akhir' => 'naik', 'is_aktif' => false]);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $tinggalSantri->id, 'semester' => '2', 'status_akhir' => 'tidak_naik', 'is_aktif' => false]);

        // Baris baru semester 1 TA berikut dengan status_awal tepat.
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $naikSantri->id, 'tahun_ajaran_id' => $f['taBaru']->id,
            'semester' => '1', 'status_awal' => 'kenaikan', 'is_aktif' => true,
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $tinggalSantri->id, 'tahun_ajaran_id' => $f['taBaru']->id,
            'semester' => '1', 'status_awal' => 'mengulang', 'is_aktif' => true,
        ]);
    }

    // ---------- 03. kenaikan wajib dari semester 2 ----------

    public function test_03_kenaikan_wajib_dari_baris_genap(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $santri = $this->makeSantri('Ganjil Dua');
        $this->makeKeanggotaan($santri, $f['mi'], '25004');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1');

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_baru_id' => $f['taBaru']->id,
            'tingkat' => '2',
            'siswa' => [['santri_id' => $santri->id, 'status' => 'naik']],
        ])->assertStatus(200);

        $this->assertSame(0, $res->json('berhasil'));
        $this->assertStringContainsString('genap', $res->json('gagal.0.pesan'));
        // Baris ganjil tetap aktif.
        $this->assertTrue((bool) RiwayatBelajar::where('santri_id', $santri->id)->firstOrFail()->is_aktif);
    }

    // ---------- 04. tidak lulus → baris mengulang TA berikut ----------

    public function test_04_tidak_lulus_membuka_baris_mengulang(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $santri = $this->makeSantri('Tidak Lulus Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25005');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['tingkat' => '1']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/tidak-lulus", [
            'lembaga_id' => $f['mi']->id,
        ])->assertStatus(200);

        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran_id' => $f['taLama']->id,
            'status_akhir' => 'tidak_lulus', 'is_aktif' => false,
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran_id' => $f['taBaru']->id,
            'semester' => '1', 'status_awal' => 'mengulang', 'is_aktif' => true,
        ]);
        // Tanpa baris alumni.
        $this->assertSame(0, Alumni::count());
        // Keanggotaan tetap aktif.
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'is_active' => true]);
    }

    // ---------- 05. kelulusan → alumni + tutup riwayat & keanggotaan ----------

    public function test_05_lulus_menulis_alumni_dan_menutup_keanggotaan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $santri = $this->makeSantri('Lulus Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25006');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '6A', '6');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['kelas_id' => $kelas->id, 'tingkat' => '6']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_lulus_id' => $f['taLama']->id,
            'tanggal_lulus' => '2026-06-20',
            'nomor_ijazah' => 'IJZ-001',
        ])->assertStatus(200);

        $this->assertSame(1, Alumni::count());
        $this->assertDatabaseHas('alumni', ['santri_id' => $santri->id, 'kelas_lulus_id' => $kelas->id]);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'status_akhir' => 'lulus', 'is_aktif' => false]);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'is_active' => false, 'tgl_selesai' => '2026-06-20']);
        $this->assertFalse((bool) $santri->fresh()->status_global);
    }

    // ---------- 06. mutasi keluar → arsip + tutup keanggotaan ----------

    public function test_06_mutasi_keluar_menulis_arsip(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $santri = $this->makeSantri('Mutasi Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25007');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '2A', '2');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelas->id]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/mutasi", [
            'lembaga_id' => $f['mi']->id,
            'kelas_terakhir_id' => $kelas->id,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => 'Ikut pindah orang tua',
        ])->assertStatus(200);

        $this->assertSame(1, MutasiKeluar::count());
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'status_akhir' => 'pindah_keluar', 'is_aktif' => false]);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'is_active' => false]);
        $this->assertFalse((bool) $santri->fresh()->status_global);
    }

    // ---------- 07. berhenti jenjang paket (MD berhenti, MI lanjut) ----------

    public function test_07_berhenti_jenjang_tidak_menghentikan_jenjang_lain(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('super_admin', []);
        $santri = $this->makeSantri('Paket Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25008');
        $this->makeKeanggotaan($santri, $f['md'], '26001');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1');
        $this->makeRiwayat($santri, $f['taMd'], $f['md'], '1');

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/berhenti-jenjang", [
            'lembaga_id' => $f['md']->id,
        ])->assertStatus(200);

        // MD tertutup, MI tetap aktif → status_global tetap true.
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'lembaga_id' => $f['md']->id, 'is_aktif' => false]);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'lembaga_id' => $f['mi']->id, 'is_aktif' => true]);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'lembaga_id' => $f['md']->id, 'is_active' => false]);
        $this->assertTrue((bool) $santri->fresh()->status_global);
    }

    // ---------- 08. guard TA selembaga ----------

    public function test_08_naik_lulus_menolak_ta_bukan_milik_lembaga(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $santri = $this->makeSantri('Guard TA');
        $this->makeKeanggotaan($santri, $f['mi'], '25009');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2');

        // TA MD dipakai untuk lembaga MI → 422.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas', [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_baru_id' => $f['taMd']->id,
            'tingkat' => '2',
            'siswa' => [['santri_id' => $santri->id, 'status' => 'naik']],
        ])->assertStatus(422)->assertJsonValidationErrors(['tahun_ajaran_baru_id']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_lulus_id' => $f['taMd']->id,
            'tanggal_lulus' => '2026-06-20',
        ])->assertStatus(422)->assertJsonValidationErrors(['tahun_ajaran_lulus_id']);
    }

    // ---------- 09. tenant scoping arsip ----------

    public function test_09_list_mutasi_alumni_terskop_tenant(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->id]);
        $adminMd = $this->makeUser('admin', [$f['md']->id]);

        $santriMi = $this->makeSantri('Arsip MI');
        $this->makeKeanggotaan($santriMi, $f['mi'], '25010');
        $this->makeRiwayat($santriMi, $f['taLama'], $f['mi'], '1');
        $santriMd = $this->makeSantri('Arsip MD');
        $this->makeKeanggotaan($santriMd, $f['md'], '26002');
        $this->makeRiwayat($santriMd, $f['taMd'], $f['md'], '1');

        $this->actingAs($adminMi, 'sanctum')->postJson("/api/admin/santri/{$santriMi->id}/mutasi", [
            'lembaga_id' => $f['mi']->id,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => 'Ikut pindah orang tua',
        ])->assertStatus(200);

        $listMi = $this->actingAs($adminMi, 'sanctum')->getJson('/api/admin/mutasi-keluar')->assertStatus(200);
        $this->assertSame(1, $listMi->json('total'));

        $listMd = $this->actingAs($adminMd, 'sanctum')->getJson('/api/admin/mutasi-keluar')->assertStatus(200);
        $this->assertSame(1, $listMd->json('total'));

        // Aksi pasangan MI↔MD diizinkan (santri lain ber-riwayat MI aktif).
        $santriBaru = $this->makeSantri('Arsip MI Dua');
        $this->makeKeanggotaan($santriBaru, $f['mi'], '25011');
        $this->makeRiwayat($santriBaru, $f['taLama'], $f['mi'], '1');
        $this->actingAs($adminMd, 'sanctum')->postJson("/api/admin/santri/{$santriBaru->id}/mutasi", [
            'lembaga_id' => $f['mi']->id,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => 'Ikut pindah orang tua',
        ])->assertStatus(200);
    }

    // ---------- 10. pindah/set/keluar kelas ----------

    public function test_10_pindah_set_kelas_validasi_dan_keluar_kelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $santri = $this->makeSantri('Pindah Kelas');
        $this->makeKeanggotaan($santri, $f['mi'], '25011');
        $kelasA = $this->makeKelas($f['mi'], $f['taLama'], '1A', '1');
        $kelasB = $this->makeKelas($f['mi'], $f['taLama'], '1B', '1');
        $kelasMd = $this->makeKelas($f['md'], $f['taMd'], 'MD-A', '1');
        $riwayat = $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelasA->id, 'tingkat' => '1']);

        // Pindah kelas selembaga & setahun → ok.
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/riwayat-belajar/{$riwayat->id}/pindah-kelas", [
            'kelas_id' => $kelasB->id,
        ])->assertStatus(200);
        $this->assertSame($kelasB->id, (int) $riwayat->fresh()->kelas_id);

        // Kelas lembaga lain → 422.
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/riwayat-belajar/{$riwayat->id}/pindah-kelas", [
            'kelas_id' => $kelasMd->id,
        ])->assertStatus(422);

        // Keluar kelas → kelas_id NULL.
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/riwayat-belajar/{$riwayat->id}/keluar-kelas")
            ->assertStatus(200);
        $this->assertNull($riwayat->fresh()->kelas_id);
    }

    // ---------- 11. daftar kelas & rekap santri ----------

    public function test_11_daftar_kelas_dan_rekap_santri(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $kelas = $this->makeKelas($f['mi'], $f['taBaru'], '1A', '1');

        $s1 = $this->makeSantri('Rekap Satu');
        $s1->update(['tgl_lahir' => now()->subYears(8)->toDateString()]);
        $this->makeKeanggotaan($s1, $f['mi'], '25012');
        $this->makeRiwayat($s1, $f['taBaru'], $f['mi'], '1', ['kelas_id' => $kelas->id, 'tingkat' => '1']);

        $s2 = $this->makeSantri('Rekap Dua');
        $s2->update(['tgl_lahir' => now()->subYears(6)->toDateString()]);
        $this->makeKeanggotaan($s2, $f['mi'], '25013');
        $this->makeRiwayat($s2, $f['taBaru'], $f['mi'], '1', ['kelas_id' => $kelas->id, 'tingkat' => '1']);

        $daftar = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/daftar-kelas?lembaga_id='.$f['mi']->id)
            ->assertStatus(200);
        $this->assertSame($f['taBaru']->id, $daftar->json('tahun_ajaran_id'));
        $this->assertSame('1', $daftar->json('semester'));
        $this->assertCount(2, $daftar->json('data'));

        $rekap = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/rekap-santri?lembaga_id='.$f['mi']->id.'&tahun_ajaran_id='.$f['taBaru']->id)
            ->assertStatus(200);
        $this->assertSame(2, $rekap->json('total_aktif'));
        $this->assertSame(2, $rekap->json('per_kelas.0.terisi'));
        $this->assertNotEmpty($rekap->json('usia_per_kelas'));
        $this->assertArrayHasKey('kelompok', $rekap->json('usia_per_kelas.0'));
    }

    // ---------- 12. profil santri memuat keanggotaan + riwayat + arsip ----------

    public function test_12_profil_santri_memuat_keanggotaan_riwayat_dan_alumni(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $santri = $this->makeSantri('Profil Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25014');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['tingkat' => '6']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'lembaga_id' => $f['mi']->id,
            'tahun_ajaran_lulus_id' => $f['taLama']->id,
            'tanggal_lulus' => '2026-06-20',
        ])->assertStatus(200);

        $res = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/santri/{$santri->id}/profil")
            ->assertStatus(200);

        $this->assertCount(1, $res->json('keanggotaan'));
        $this->assertSame('25014', $res->json('keanggotaan.0.nis_lokal'));
        $this->assertNotEmpty($res->json('riwayat'));
        $this->assertCount(1, $res->json('alumni'));
    }

    // ---------- 13. beku kelas: mutasi otomatis, input manual menang ----------

    public function test_13_mutasi_beku_kelas_otomatis_dan_override_manual(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->id]);
        $kelasA = $this->makeKelas($f['mi'], $f['taLama'], '3A', '3');
        $kelasB = $this->makeKelas($f['mi'], $f['taLama'], '3B', '3');

        // Tanpa input → beku dari riwayat aktif terakhir.
        $s1 = $this->makeSantri('Beku Otomatis');
        $this->makeKeanggotaan($s1, $f['mi'], '25015');
        $this->makeRiwayat($s1, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelasA->id]);
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$s1->id}/mutasi", [
            'lembaga_id' => $f['mi']->id,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => 'Ikut pindah orang tua',
        ])->assertStatus(200);
        $this->assertDatabaseHas('mutasi_keluar', ['santri_id' => $s1->id, 'kelas_terakhir_id' => $kelasA->id]);

        // Input manual → menang atas snapshot.
        $s2 = $this->makeSantri('Beku Override');
        $this->makeKeanggotaan($s2, $f['mi'], '25016');
        $this->makeRiwayat($s2, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelasA->id]);
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$s2->id}/mutasi", [
            'lembaga_id' => $f['mi']->id,
            'kelas_terakhir_id' => $kelasB->id,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => 'Ikut pindah orang tua',
        ])->assertStatus(200);
        $this->assertDatabaseHas('mutasi_keluar', ['santri_id' => $s2->id, 'kelas_terakhir_id' => $kelasB->id]);
    }
}
