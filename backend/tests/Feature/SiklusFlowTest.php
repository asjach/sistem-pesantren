<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\LembagaTahunAjaran;
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
    }

    // ---------- helpers ----------

    /** Benih status/alasan per lembaga fixture (tanpa baris global). */
    protected function ensureRefs(array $f): void
    {
        foreach ([$f['mi']->jenjang, $f['md']->jenjang] as $lid) {
            foreach ([
                ['kode' => 'santri_baru', 'nama' => 'Santri Baru'],
                ['kode' => 'mengulang', 'nama' => 'Mengulang'],
                ['kode' => 'pindahan', 'nama' => 'Pindahan'],
                ['kode' => 'kenaikan', 'nama' => 'Kenaikan Kelas'],
            ] as $i => $r) {
                DB::table('ref_status_awal')->updateOrInsert(
                    ['jenjang' => $lid, 'kode' => $r['kode']],
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
                    ['jenjang' => $lid, 'kode' => $r['kode']],
                    ['nama' => $r['nama'], 'is_aktif_bawaan' => $r['kode'] === 'aktif', 'terminal_ke' => null, 'urutan' => $i, 'is_active' => true]
                );
            }
            foreach (['Ikut pindah orang tua', 'Lainnya'] as $i => $nama) {
                DB::table('ref_alasan_mutasi')->updateOrInsert(
                    ['jenjang' => $lid, 'nama' => $nama],
                    ['urutan' => $i, 'is_active' => true]
                );
            }
        }
        Cache::flush();
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
        // TA global (berlaku semua lembaga); taLama juga dipakai MD.
        $taLama = TahunAjaran::create([
            'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => false,
        ]);
        $taBaru = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taMd = $taLama;
        // TA luar lingkup MI (disembunyikan untuk MI) → guard "bukan milik lembaga".
        $taLuar = TahunAjaran::create([
            'nama' => '2024/2025',
            'tanggal_mulai' => '2024-07-01', 'tanggal_selesai' => '2025-06-30', 'is_aktif' => false,
        ]);
        LembagaTahunAjaran::create([
            'jenjang' => $mi->jenjang, 'tahun_ajaran' => $taLuar->nama, 'is_active' => false,
        ]);

        $this->ensureRefs(['mi' => $mi, 'md' => $md]);

        return compact('root', 'mi', 'md', 'taLama', 'taBaru', 'taMd', 'taLuar');
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
                'user_id' => $u->id, 'jenjang' => $lid,
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
            'jenjang' => $lembaga->jenjang,
            'nis_lokal' => $nisLokal,
            'is_active_lembaga' => $aktif ? 'Ya' : 'Tidak',
            'tgl_masuk' => '2025-07-01',
        ]);
    }

    protected function makeKelas(Lembaga $lembaga, TahunAjaran $ta, string $nama, ?string $tingkat = null): Kelas
    {
        return Kelas::create([
            'jenjang' => $lembaga->jenjang,
            'tahun_ajaran' => $ta->nama,
            'nama_kelas' => $nama.'-'.uniqid(),
            'tingkat' => $tingkat,
        ]);
    }

    protected function makeRiwayat(Santri $santri, TahunAjaran $ta, Lembaga $lembaga, string $semester, array $opt = []): RiwayatBelajar
    {
        return RiwayatBelajar::create(array_merge([
            'santri_id' => $santri->id,
            'tahun_ajaran' => $ta->nama,
            'jenjang' => $lembaga->jenjang,
            'kelas_id' => null,
            'semester' => $semester,
            'tgl_masuk' => '2025-07-15',
            'tingkat' => '1',
            'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya',
        ], $opt));
    }

    // ---------- 01. salin genap massal ----------

    public function test_01_salin_genap_massal_api(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Ganjil Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25001');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '1A', '1');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelas->id]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'jenjang' => $f['mi']->jenjang,
            'tanggal_masuk' => '2026-01-05',
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('berhasil'));
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['taLama']->nama,
            'semester' => '2', 'kelas_id' => $kelas->id, 'is_active_riwayat' => 'Ya',
        ]);
        // Genap dibuka 'lanjutan'; ganjil arsip tetap 'aktif'.
        $genap = RiwayatBelajar::where('santri_id', $santri->id)->where('semester', '2')->firstOrFail();
        $this->assertSame('lanjutan', $genap->status_awal);
        $ganjil = RiwayatBelajar::where('santri_id', $santri->id)->where('semester', '1')->firstOrFail();
        $this->assertSame('aktif', $ganjil->status_akhir);
        $this->assertSame('Tidak', $ganjil->is_active_riwayat);
        $this->assertSame('Tidak', RiwayatBelajar::where('santri_id', $santri->id)->where('semester', '1')->firstOrFail()->is_active_riwayat);

        // Salin ulang baris yang ganjilnya sudah tertutup → per-item gagal (partial), bukan 500.
        $res2 = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'jenjang' => $f['mi']->jenjang,
            'tanggal_masuk' => '2026-01-05',
            'siswa' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);
        $this->assertSame(0, $res2->json('berhasil'));
        $this->assertCount(1, $res2->json('gagal'));
    }

    // ---------- 01b. salin genap dari ganjil pindahan → tetap 'lanjutan' ----------

    public function test_01b_salin_genap_dari_pindahan_tetap_lanjutan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Ganjil Pindahan');
        $this->makeKeanggotaan($santri, $f['mi'], '25011');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '1B', '1');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelas->id, 'status_awal' => 'pindahan']);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'jenjang' => $f['mi']->jenjang,
            'tanggal_masuk' => '2026-01-05',
            'siswa' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);

        $genap = RiwayatBelajar::where('santri_id', $santri->id)->where('semester', '2')->firstOrFail();
        $this->assertSame('lanjutan', $genap->status_awal);
        $this->assertSame('aktif', $genap->status_akhir);
    }

    // ---------- 01c. batal salin: genap dihapus, ganjil dibuka lagi ----------

    public function test_01c_batal_salin_kembalikan_ganjil(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Batal Salin');
        $this->makeKeanggotaan($santri, $f['mi'], '25012');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '1C', '1');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelas->id]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'jenjang' => $f['mi']->jenjang,
            'tanggal_masuk' => '2026-01-05',
            'siswa' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);
        $this->assertSame(2, RiwayatBelajar::where('santri_id', $santri->id)->count());

        $res = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/batal-salin", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(200);
        $this->assertSame('Salin semester dibatalkan; santri kembali ke semester 1.', $res->json('pesan'));

        $this->assertSame(1, RiwayatBelajar::where('santri_id', $santri->id)->count());
        $ganjil = RiwayatBelajar::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame('1', $ganjil->semester);
        $this->assertSame('Ya', $ganjil->is_active_riwayat);
        $this->assertSame('Ya', $santri->fresh()->is_active_pst);
    }

    // ---------- 01d. batal salin ditolak bila tak ada genap / sudah lanjut ----------

    public function test_01d_batal_salin_ditolak_tanpa_genap_atau_sudah_lanjut(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Batal Tolak');
        $this->makeKeanggotaan($santri, $f['mi'], '25013');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1');

        // Belum disalin → tak ada yang dibatalkan.
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/batal-salin", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(422);

        // Sudah ada transisi lanjutan (baris aktif terbaru bukan genap) → ditolak.
        $this->makeRiwayat($santri, $f['taBaru'], $f['mi'], '1');
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/batal-salin", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(422);
        $this->assertSame(2, RiwayatBelajar::where('santri_id', $santri->id)->count());
    }

    // ---------- 01e. batal salin: genap dari import (ganjil masih aktif) ----------

    public function test_01e_batal_salin_genap_import_ganjil_masih_aktif(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Genap Import');
        $this->makeKeanggotaan($santri, $f['mi'], '25014');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '1D', '1');
        // Ganjil TIDAK ditutup (pola import: baris genap dibuat tanpa salin).
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelas->id]);
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['kelas_id' => $kelas->id, 'status_awal' => 'lanjutan']);

        $res = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/batal-salin", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(200);
        $this->assertSame('Salin semester dibatalkan; santri kembali ke semester 1.', $res->json('pesan'));

        $sisa = RiwayatBelajar::where('santri_id', $santri->id)->get();
        $this->assertCount(1, $sisa);
        $this->assertSame('1', $sisa->first()->semester);
        $this->assertSame('Ya', $sisa->first()->is_active_riwayat);
    }

    // ---------- 02. kenaikan massal naik/tidak naik ----------

    public function test_02_naik_kelas_massal_naik_dan_tidak_naik(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);

        $naikSantri = $this->makeSantri('Naik Satu');
        $this->makeKeanggotaan($naikSantri, $f['mi'], '25002');
        $this->makeRiwayat($naikSantri, $f['taLama'], $f['mi'], '2', ['tingkat' => '1']);

        $tinggalSantri = $this->makeSantri('Tinggal Satu');
        $this->makeKeanggotaan($tinggalSantri, $f['mi'], '25003');
        $this->makeRiwayat($tinggalSantri, $f['taLama'], $f['mi'], '2', ['tingkat' => '1']);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_baru' => $f['taBaru']->nama,
            'tingkat' => '2',
            'siswa' => [
                ['santri_id' => $naikSantri->id, 'status' => 'naik'],
                ['santri_id' => $tinggalSantri->id, 'status' => 'tidak_naik'],
            ],
        ])->assertStatus(200);

        $this->assertSame(2, $res->json('berhasil'));

        // Baris lama ditutup dengan hasil masing-masing.
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $naikSantri->id, 'semester' => '2', 'status_akhir' => 'naik', 'is_active_riwayat' => 'Tidak']);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $tinggalSantri->id, 'semester' => '2', 'status_akhir' => 'tidak_naik', 'is_active_riwayat' => 'Tidak']);

        // Baris baru semester 1 TA berikut dengan status_awal tepat.
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $naikSantri->id, 'tahun_ajaran' => $f['taBaru']->nama,
            'semester' => '1', 'status_awal' => 'kenaikan', 'is_active_riwayat' => 'Ya',
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $tinggalSantri->id, 'tahun_ajaran' => $f['taBaru']->nama,
            'semester' => '1', 'status_awal' => 'mengulang', 'is_active_riwayat' => 'Ya',
        ]);
    }

    // ---------- 03. kenaikan wajib dari semester 2 ----------

    public function test_03_kenaikan_wajib_dari_baris_genap(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Ganjil Dua');
        $this->makeKeanggotaan($santri, $f['mi'], '25004');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1');

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_baru' => $f['taBaru']->nama,
            'tingkat' => '2',
            'siswa' => [['santri_id' => $santri->id, 'status' => 'naik']],
        ])->assertStatus(200);

        $this->assertSame(0, $res->json('berhasil'));
        $this->assertStringContainsString('genap', $res->json('gagal.0.pesan'));
        // Baris ganjil tetap aktif.
        $this->assertSame('Ya', RiwayatBelajar::where('santri_id', $santri->id)->firstOrFail()->is_active_riwayat);
    }

    // ---------- 04. tidak lulus → baris mengulang TA berikut ----------

    public function test_04_tidak_lulus_membuka_baris_mengulang(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Tidak Lulus Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25005');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['tingkat' => '1']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/tidak-lulus", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(200);

        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['taLama']->nama,
            'status_akhir' => 'tidak_lulus', 'is_active_riwayat' => 'Tidak',
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['taBaru']->nama,
            'semester' => '1', 'status_awal' => 'mengulang', 'is_active_riwayat' => 'Ya',
        ]);
        // Tanpa baris alumni.
        $this->assertSame(0, Alumni::count());
        // Keanggotaan tetap aktif.
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'is_active_lembaga' => 'Ya']);
    }

    // ---------- 05. kelulusan → alumni + tutup riwayat & keanggotaan ----------

    public function test_05_lulus_menulis_alumni_dan_menutup_keanggotaan(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Lulus Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25006');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '6A', '6');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['kelas_id' => $kelas->id, 'tingkat' => '6']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_lulus' => $f['taLama']->nama,
            'tanggal_lulus' => '2026-06-20',
            'nomor_ijazah' => 'IJZ-001',
        ])->assertStatus(200);

        $this->assertSame(1, Alumni::count());
        $this->assertDatabaseHas('alumni', ['santri_id' => $santri->id, 'kelas_lulus_id' => $kelas->id]);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'status_akhir' => 'lulus', 'is_active_riwayat' => 'Tidak']);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'is_active_lembaga' => 'Tidak', 'tgl_selesai' => '2026-06-20']);
        $this->assertSame('Tidak', $santri->fresh()->is_active_pst);
    }

    // ---------- 06. mutasi keluar → arsip + tutup keanggotaan ----------

    public function test_06_mutasi_keluar_menulis_arsip(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Mutasi Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25007');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '2A', '2');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelas->id]);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/mutasi", [
            'jenjang' => $f['mi']->jenjang,
            'kelas_terakhir_id' => $kelas->id,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => 'Ikut pindah orang tua',
        ])->assertStatus(200);

        $this->assertSame(1, MutasiKeluar::count());
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'status_akhir' => 'pindah_keluar', 'is_active_riwayat' => 'Tidak']);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'is_active_lembaga' => 'Tidak']);
        $this->assertSame('Tidak', $santri->fresh()->is_active_pst);
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
            'jenjang' => $f['md']->jenjang,
        ])->assertStatus(200);

        // MD tertutup, MI tetap aktif → is_active_pst tetap 'Ya'.
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'jenjang' => $f['md']->jenjang, 'is_active_riwayat' => 'Tidak']);
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang, 'is_active_riwayat' => 'Ya']);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'jenjang' => $f['md']->jenjang, 'is_active_lembaga' => 'Tidak']);
        $this->assertSame('Ya', $santri->fresh()->is_active_pst);
    }

    // ---------- 08. guard TA selembaga ----------

    public function test_08_naik_lulus_menolak_ta_bukan_milik_lembaga(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Guard TA');
        $this->makeKeanggotaan($santri, $f['mi'], '25009');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2');

        // TA di luar lingkup MI → 422.
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_baru' => $f['taLuar']->nama,
            'tingkat' => '2',
            'siswa' => [['santri_id' => $santri->id, 'status' => 'naik']],
        ])->assertStatus(422)->assertJsonValidationErrors(['tahun_ajaran_baru']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_lulus' => $f['taLuar']->nama,
            'tanggal_lulus' => '2026-06-20',
        ])->assertStatus(422)->assertJsonValidationErrors(['tahun_ajaran_lulus']);
    }

    // ---------- 09. tenant scoping arsip ----------

    public function test_09_list_mutasi_alumni_terskop_tenant(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);
        $adminMd = $this->makeUser('admin', [$f['md']->jenjang]);

        $santriMi = $this->makeSantri('Arsip MI');
        $this->makeKeanggotaan($santriMi, $f['mi'], '25010');
        $this->makeRiwayat($santriMi, $f['taLama'], $f['mi'], '1');
        $santriMd = $this->makeSantri('Arsip MD');
        $this->makeKeanggotaan($santriMd, $f['md'], '26002');
        $this->makeRiwayat($santriMd, $f['taMd'], $f['md'], '1');

        $this->actingAs($adminMi, 'sanctum')->postJson("/api/admin/santri/{$santriMi->id}/mutasi", [
            'jenjang' => $f['mi']->jenjang,
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
            'jenjang' => $f['mi']->jenjang,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => 'Ikut pindah orang tua',
        ])->assertStatus(200);
    }

    // ---------- 10. pindah/set/keluar kelas ----------

    public function test_10_pindah_set_kelas_validasi_dan_keluar_kelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
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
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
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
            ->getJson('/api/admin/akademik/daftar-kelas?jenjang='.$f['mi']->jenjang)
            ->assertStatus(200);
        $this->assertSame($f['taBaru']->nama, $daftar->json('tahun_ajaran'));
        $this->assertSame('1', $daftar->json('semester'));
        $this->assertCount(2, $daftar->json('data'));

        $rekap = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/rekap-santri?jenjang='.$f['mi']->jenjang.'&tahun_ajaran='.$f['taBaru']->nama)
            ->assertStatus(200);
        $this->assertSame(2, $rekap->json('total_aktif'));
        $this->assertSame(2, $rekap->json('per_kelas.0.terisi'));
        $this->assertNotEmpty($rekap->json('usia_per_kelas'));
        $this->assertArrayHasKey('kelompok', $rekap->json('usia_per_kelas.0'));
    }

    // ---------- 12. daftar kelas basis status_akhir + lintas periode ----------

    public function test_13_daftar_kelas_kelompok_status_lintas_periode(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $kelas = $this->makeKelas($f['mi'], $f['taBaru'], '1B', '1');

        $s1 = $this->makeSantri('Kelompok Satu');
        $this->makeKeanggotaan($s1, $f['mi'], '25101');
        $this->makeRiwayat($s1, $f['taBaru'], $f['mi'], '1', ['kelas_id' => $kelas->id]);

        // Lulus lintas TA (flag is_aktif mati) tetap tampil di kelompok aktif:
        // basis = status_akhir, bukan is_aktif.
        $s2 = $this->makeSantri('Kelompok Dua');
        $this->makeKeanggotaan($s2, $f['mi'], '25102');
        $this->makeRiwayat($s2, $f['taLama'], $f['mi'], '2', ['status_akhir' => 'lulus', 'is_active_riwayat' => 'Tidak']);

        $s3 = $this->makeSantri('Kelompok Tiga');
        $this->makeKeanggotaan($s3, $f['mi'], '25103');
        $this->makeRiwayat($s3, $f['taBaru'], $f['mi'], '1', ['status_akhir' => 'pindah_keluar', 'is_active_riwayat' => 'Tidak']);

        $aktif = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/daftar-kelas?jenjang='.$f['mi']->jenjang.'&kelompok_status=aktif&lintas_periode=1')
            ->assertStatus(200);
        $nama = collect($aktif->json('data'))->pluck('santri.nama_lengkap');
        $this->assertTrue($nama->contains(fn ($n) => str_starts_with($n, 'Kelompok Satu')));
        $this->assertTrue($nama->contains(fn ($n) => str_starts_with($n, 'Kelompok Dua')));
        $this->assertFalse($nama->contains(fn ($n) => str_starts_with($n, 'Kelompok Tiga')));
        $this->assertNotNull($aktif->json('data.0.tahun_ajaran.nama'));

        $non = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/daftar-kelas?jenjang='.$f['mi']->jenjang.'&kelompok_status=nonaktif&lintas_periode=1')
            ->assertStatus(200);
        $namaNon = collect($non->json('data'))->pluck('santri.nama_lengkap');
        $this->assertTrue($namaNon->contains(fn ($n) => str_starts_with($n, 'Kelompok Tiga')));
        $this->assertFalse($namaNon->contains(fn ($n) => str_starts_with($n, 'Kelompok Satu')));

        // Tanpa kelompok: perilaku lama (is_aktif + default periode).
        $lama = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/daftar-kelas?jenjang='.$f['mi']->jenjang)
            ->assertStatus(200);
        $namaLama = collect($lama->json('data'))->pluck('santri.nama_lengkap');
        $this->assertTrue($namaLama->contains(fn ($n) => str_starts_with($n, 'Kelompok Satu')));
        $this->assertFalse($namaLama->contains(fn ($n) => str_starts_with($n, 'Kelompok Dua')));
    }

    // ---------- 14. daftar kelas muatan penuh 3 tabel + PATCH riwayat ----------

    public function test_14_daftar_kelas_penuh_tiga_tabel_dan_ubah_riwayat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $kelas = $this->makeKelas($f['mi'], $f['taBaru'], '1A', '1');

        $s = $this->makeSantri('Penuh Satu');
        $s->update(['nik' => '1234567890123456', 'nisn' => '1234567890', 'ayah_nama' => 'Ayah Penuh']);
        $this->makeKeanggotaan($s, $f['mi'], '25201');
        LembagaSantri::where('santri_id', $s->id)->where('jenjang', $f['mi']->jenjang)
            ->update(['nis_kemenag' => '1234567890122601', 'tgl_selesai' => null]);
        $riwayat = $this->makeRiwayat($s, $f['taBaru'], $f['mi'], '1', ['kelas_id' => $kelas->id, 'tingkat' => '1']);

        // Muatan penuh: santri.* + lembaga_anggota.* + relasi + nis_lokal ringkas.
        $daftar = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/daftar-kelas?jenjang='.$f['mi']->jenjang)
            ->assertStatus(200);
        $baris = $daftar->json('data.0');
        $this->assertSame('1234567890123456', $baris['santri']['nik']);
        $this->assertSame('Ayah Penuh', $baris['santri']['ayah_nama']);
        $this->assertSame('25201', $baris['lembaga_anggota']['nis_lokal']);
        $this->assertSame('1234567890122601', $baris['lembaga_anggota']['nis_kemenag']);
        $this->assertSame('2025-07-01', $baris['lembaga_anggota']['tgl_masuk']);
        $this->assertSame('MI', $baris['lembaga']['jenjang']);
        $this->assertSame('25201', $baris['nis_lokal']);

        // PATCH kolom skalar → ok.
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/riwayat-belajar/{$riwayat->id}", [
            'tingkat' => '2', 'no_absen' => 7, 'tgl_masuk' => '2026-07-10',
        ])->assertStatus(200)->assertJsonPath('data.tingkat', '2');
        $this->assertSame(7, (int) $riwayat->fresh()->no_absen);

        // Kolom lifecycle dikunci: status_akhir/is_aktif diabaikan (tetap 200).
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/riwayat-belajar/{$riwayat->id}", [
            'status_akhir' => 'lulus', 'is_active_riwayat' => 'Tidak',
        ])->assertStatus(200);
        $this->assertSame('aktif', $riwayat->fresh()->status_akhir);
        $this->assertSame('Ya', $riwayat->fresh()->is_active_riwayat);

        // Semester duplikat (santri+TA+lembaga+semester unik) → 422; di luar 1/2 → 422.
        $this->makeRiwayat($s, $f['taBaru'], $f['mi'], '2');
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/riwayat-belajar/{$riwayat->id}", [
            'semester' => '2',
        ])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/riwayat-belajar/{$riwayat->id}", [
            'semester' => '3',
        ])->assertStatus(422);

        // Admin lembaga lain (di luar pasangan MI↔MD) → 403.
        $ra = Lembaga::create([
            'nama' => 'Raudhatul Athfal', 'jenjang' => 'RA',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $adminRa = $this->makeUser('admin', [$ra->jenjang]);
        $this->actingAs($adminRa, 'sanctum')->patchJson("/api/admin/riwayat-belajar/{$riwayat->id}", [
            'tingkat' => '3',
        ])->assertStatus(403);
    }

    // ---------- 12. profil santri memuat keanggotaan + riwayat + arsip ----------

    public function test_12_profil_santri_memuat_keanggotaan_riwayat_dan_alumni(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Profil Satu');
        $this->makeKeanggotaan($santri, $f['mi'], '25014');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['tingkat' => '6']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_lulus' => $f['taLama']->nama,
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
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $kelasA = $this->makeKelas($f['mi'], $f['taLama'], '3A', '3');
        $kelasB = $this->makeKelas($f['mi'], $f['taLama'], '3B', '3');

        // Tanpa input → beku dari riwayat aktif terakhir.
        $s1 = $this->makeSantri('Beku Otomatis');
        $this->makeKeanggotaan($s1, $f['mi'], '25015');
        $this->makeRiwayat($s1, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelasA->id]);
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$s1->id}/mutasi", [
            'jenjang' => $f['mi']->jenjang,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => 'Ikut pindah orang tua',
        ])->assertStatus(200);
        $this->assertDatabaseHas('mutasi_keluar', ['santri_id' => $s1->id, 'kelas_terakhir_id' => $kelasA->id]);

        // Input manual → menang atas snapshot.
        $s2 = $this->makeSantri('Beku Override');
        $this->makeKeanggotaan($s2, $f['mi'], '25016');
        $this->makeRiwayat($s2, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelasA->id]);
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$s2->id}/mutasi", [
            'jenjang' => $f['mi']->jenjang,
            'kelas_terakhir_id' => $kelasB->id,
            'tanggal_mutasi' => '2026-05-01',
            'alasan_mutasi' => 'Ikut pindah orang tua',
        ])->assertStatus(200);
        $this->assertDatabaseHas('mutasi_keluar', ['santri_id' => $s2->id, 'kelas_terakhir_id' => $kelasB->id]);
    }

    // ---------- 14. kenaikan otomatis: TA + kelas dibuatkan ----------

    public function test_14_naik_otomatis_kelas_bertambah_ta_ada(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);

        $kelas1A = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taLama']->nama,
            'nama_kelas' => '1A', 'tingkat' => '1',
        ]);
        $s = $this->makeSantri('Otomatis Satu');
        $this->makeKeanggotaan($s, $f['mi'], '25120');
        $this->makeRiwayat($s, $f['taLama'], $f['mi'], '2', ['tingkat' => '1', 'kelas_id' => $kelas1A->id]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas-otomatis', [
            'jenjang' => $f['mi']->jenjang,
            'siswa' => [['santri_id' => $s->id, 'status' => 'naik', 'tgl_masuk' => '2026-07-15']],
        ])->assertStatus(200);
        $this->assertSame(1, $res->json('berhasil'), json_encode($res->json('gagal')));
        // Respons memuat kelas/tingkat tujuan agar UI tak menampilkan kelas lama.
        $this->assertSame('2A', $res->json('data.0.kelas'));
        $this->assertSame('2', (string) $res->json('data.0.tingkat'));

        // TA 2026/2027 milik lembaga dipakai; kelas 2A dibuat otomatis.
        $kelas2A = Kelas::where('jenjang', $f['mi']->jenjang)
            ->where('tahun_ajaran', $f['taBaru']->nama)->where('nama_kelas', '2A')->firstOrFail();
        $this->assertSame('2', $kelas2A->tingkat);

        // Baris lama ditutup naik; baris baru kenaikan + aktif + tgl masuk.
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $s->id, 'tahun_ajaran' => $f['taLama']->nama,
            'semester' => '2', 'status_akhir' => 'naik', 'is_active_riwayat' => 'Tidak',
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $s->id, 'tahun_ajaran' => $f['taBaru']->nama,
            'semester' => '1', 'kelas_id' => $kelas2A->id, 'tingkat' => '2',
            'status_awal' => 'kenaikan', 'status_akhir' => 'aktif',
            'tgl_masuk' => '2026-07-15', 'is_active_riwayat' => 'Ya',
        ]);

        // Filter status_awal (sumber tabel hasil Kenaikan) memuat baris baru.
        $daftar = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/riwayat-belajar?'.http_build_query([
            'jenjang' => $f['mi']->jenjang, 'status_awal' => 'kenaikan', 'is_active_riwayat' => 1,
        ]))->assertStatus(200);
        $this->assertSame('2A', $daftar->json('data.0.kelas.nama_kelas'));
    }

    public function test_15_naik_otomatis_ta_baru_tidak_naik_dan_gagal_jelas(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);

        $kelas3C = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taBaru']->nama,
            'nama_kelas' => '3C', 'tingkat' => '3',
        ]);
        $sTinggal = $this->makeSantri('Otomatis Tinggal');
        $this->makeKeanggotaan($sTinggal, $f['mi'], '25121');
        $this->makeRiwayat($sTinggal, $f['taBaru'], $f['mi'], '2', ['tingkat' => '3', 'kelas_id' => $kelas3C->id]);

        $kelasPagi = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taBaru']->nama,
            'nama_kelas' => 'Pagi', 'tingkat' => '1',
        ]);
        $sAneh = $this->makeSantri('Otomatis Aneh');
        $this->makeKeanggotaan($sAneh, $f['mi'], '25122');
        $this->makeRiwayat($sAneh, $f['taBaru'], $f['mi'], '2', ['tingkat' => '1', 'kelas_id' => $kelasPagi->id]);

        $kelas6A = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taBaru']->nama,
            'nama_kelas' => '6A', 'tingkat' => '6',
        ]);
        $sAkhir = $this->makeSantri('Otomatis Akhir');
        $this->makeKeanggotaan($sAkhir, $f['mi'], '25123');
        $this->makeRiwayat($sAkhir, $f['taBaru'], $f['mi'], '2', ['tingkat' => '6', 'kelas_id' => $kelas6A->id]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas-otomatis', [
            'jenjang' => $f['mi']->jenjang,
            'siswa' => [
                ['santri_id' => $sTinggal->id, 'status' => 'tidak_naik', 'tgl_masuk' => '2027-07-15'],
                ['santri_id' => $sAneh->id, 'status' => 'naik', 'tgl_masuk' => '2027-07-15'],
                ['santri_id' => $sAkhir->id, 'status' => 'naik', 'tgl_masuk' => '2027-07-15'],
            ],
        ])->assertStatus(200);
        $this->assertSame(1, $res->json('berhasil'));
        $this->assertCount(2, $res->json('gagal'));

        // TA 2027/2028 dibuat global; tidak_naik memakai kelas senama.
        $taBaru2 = TahunAjaran::where('nama', '2027/2028')->firstOrFail();
        $kelas3Cbaru = Kelas::where('jenjang', $f['mi']->jenjang)
            ->where('tahun_ajaran', $taBaru2->nama)->where('nama_kelas', '3C')->firstOrFail();
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $sTinggal->id, 'tahun_ajaran' => $taBaru2->nama,
            'semester' => '1', 'kelas_id' => $kelas3Cbaru->id, 'tingkat' => '3',
            'status_awal' => 'mengulang', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        // Kelas tak berangka + tingkat akhir gagal jelas, baris lama utuh.
        $pesan = collect($res->json('gagal'))->pluck('pesan')->join(' ');
        $this->assertStringContainsString('angka', $pesan);
        $this->assertStringContainsString('Kelulusan', $pesan);
        $this->assertTrue((bool) RiwayatBelajar::where('santri_id', $sAneh->id)->where('is_active_riwayat', 'Ya')->exists());
        $this->assertTrue((bool) RiwayatBelajar::where('santri_id', $sAkhir->id)->where('is_active_riwayat', 'Ya')->exists());
    }

    // ---------- 15. batal kenaikan: hapus baru + buka lama ----------

    public function test_16_batal_kenaikan_mengembalikan_baris_asal(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);

        $kelas1A = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taLama']->nama,
            'nama_kelas' => '1A', 'tingkat' => '1',
        ]);
        $s = $this->makeSantri('Batal Satu');
        $this->makeKeanggotaan($s, $f['mi'], '25130');
        $this->makeRiwayat($s, $f['taLama'], $f['mi'], '2', ['tingkat' => '1', 'kelas_id' => $kelas1A->id]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/naik-kelas-otomatis', [
            'jenjang' => $f['mi']->jenjang,
            'siswa' => [['santri_id' => $s->id, 'status' => 'naik', 'tgl_masuk' => '2026-07-15']],
        ])->assertStatus(200)->assertJsonPath('berhasil', 1);

        $res = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$s->id}/batal-kenaikan", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(200);
        $this->assertSame('aktif', $res->json('data.status_akhir'));

        // Baris baru hilang; baris asal aktif kembali.
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $s->id)->count());
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $s->id, 'tahun_ajaran' => $f['taLama']->nama,
            'semester' => '2', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        // Batal kedua kali → 422 jelas (tak ada hasil aktif).
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$s->id}/batal-kenaikan", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(422);
    }
}
