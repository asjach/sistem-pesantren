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
use App\Models\SemesterAktif;
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
                ['kode' => 'lanjut', 'nama' => 'Lanjut'],
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
        // Genap dibuka 'lanjutan'; ganjil arsip jadi 'lanjut' (santri lanjut ke genap).
        $genap = RiwayatBelajar::where('santri_id', $santri->id)->where('semester', '2')->firstOrFail();
        $this->assertSame('lanjutan', $genap->status_awal);
        $ganjil = RiwayatBelajar::where('santri_id', $santri->id)->where('semester', '1')->firstOrFail();
        $this->assertSame('lanjut', $ganjil->status_akhir);
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

    public function test_salin_genap_dari_riwayat_id_mengikuti_ta_dan_semester_aktif(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);

        $aktif = $this->makeSantri('Aktif Pindah');
        $this->makeKeanggotaan($aktif, $f['mi'], '25031');
        $riwayatAktif = $this->makeRiwayat($aktif, $f['taBaru'], $f['mi'], '1', [
            'kelas_id' => null,
            'status_akhir' => 'naik',
            'is_active_riwayat' => 'Tidak',
        ]);
        SemesterAktif::create(['jenjang' => $f['mi']->jenjang, 'semester' => '1']);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'jenjang' => $f['mi']->jenjang,
            'tanggal_masuk' => '2027-01-05',
            'siswa' => [['santri_id' => $aktif->id, 'riwayat_id' => $riwayatAktif->id]],
        ])->assertStatus(200);
        $this->assertSame(1, $res->json('berhasil'));
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $aktif->id,
            'tahun_ajaran' => $f['taBaru']->nama,
            'semester' => '2',
            'is_active_riwayat' => 'Ya',
        ]);

        $historis = $this->makeSantri('Historis Pindah');
        $this->makeKeanggotaan($historis, $f['mi'], '25032');
        $kelasHistoris = $this->makeKelas($f['mi'], $f['taLama'], '3B', '1');
        $riwayatHistoris = $this->makeRiwayat($historis, $f['taLama'], $f['mi'], '1', ['kelas_id' => $kelasHistoris->id]);
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'jenjang' => $f['mi']->jenjang,
            'tanggal_masuk' => '2027-01-05',
            'siswa' => [['santri_id' => $historis->id, 'riwayat_id' => $riwayatHistoris->id]],
        ])->assertStatus(200);
        $this->assertSame(0, $res->json('berhasil'));
        $this->assertStringContainsString('tahun ajaran aktif', $res->json('gagal.0.pesan'));

        $genap = $this->makeSantri('Semester Genap');
        $this->makeKeanggotaan($genap, $f['mi'], '25033');
        $kelasGenap = $this->makeKelas($f['mi'], $f['taBaru'], '3C', '1');
        $riwayatGenap = $this->makeRiwayat($genap, $f['taBaru'], $f['mi'], '1', ['kelas_id' => $kelasGenap->id]);
        SemesterAktif::where('jenjang', $f['mi']->jenjang)->update(['semester' => '2']);
        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'jenjang' => $f['mi']->jenjang,
            'tanggal_masuk' => '2027-01-05',
            'siswa' => [['santri_id' => $genap->id, 'riwayat_id' => $riwayatGenap->id]],
        ])->assertStatus(200);
        $this->assertSame(0, $res->json('berhasil'));
        $this->assertStringContainsString('semester aktif Ganjil', $res->json('gagal.0.pesan'));
    }

    public function test_pindah_dan_batal_massa_menggunakan_status_akhir(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        SemesterAktif::create(['jenjang' => $f['mi']->jenjang, 'semester' => '1']);

        $aktif = $this->makeSantri('Aktif Status Akhir');
        $this->makeKeanggotaan($aktif, $f['mi'], '25034');
        $riwayatAktif = $this->makeRiwayat($aktif, $f['taBaru'], $f['mi'], '1', [
            'status_akhir' => 'naik',
            'is_active_riwayat' => 'Tidak',
        ]);
        $kelasLain = $this->makeKelas($f['mi'], $f['taBaru'], '4B', '2');
        $aktifLain = $this->makeSantri('Aktif Tingkat Lain');
        $this->makeKeanggotaan($aktifLain, $f['mi'], '25036');
        $this->makeRiwayat($aktifLain, $f['taBaru'], $f['mi'], '1', [
            'kelas_id' => $kelasLain->id,
            'tingkat' => '2',
            'status_akhir' => 'naik',
            'is_active_riwayat' => 'Tidak',
        ]);
        $nonaktif = $this->makeSantri('Pindah Keluar');
        $this->makeKeanggotaan($nonaktif, $f['mi'], '25035');
        $this->makeRiwayat($nonaktif, $f['taBaru'], $f['mi'], '1', [
            'status_akhir' => 'pindah_keluar',
            'is_active_riwayat' => 'Tidak',
        ]);

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/akademik/ringkasan-pindah-genap?'.http_build_query([
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taBaru']->nama,
            'tingkat' => ['1'],
            'kelas_id' => [$kelasLain->id],
        ]))->assertStatus(200);
        $this->assertSame(2, $res->json('data.aktif'));
        $this->assertSame(1, $res->json('data.tidak_aktif'));
        $this->assertSame([$nonaktif->nama_lengkap], $res->json('data.nama_tidak_aktif'));

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/salin-genap', [
            'jenjang' => $f['mi']->jenjang,
            'tanggal_masuk' => '2027-01-05',
            'konteks_aktif' => true,
            'tahun_ajaran' => $f['taBaru']->nama,
            'tingkat' => ['1'],
            'kelas_id' => [$kelasLain->id],
        ])->assertStatus(200);
        $this->assertSame(2, $res->json('berhasil'));
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $aktif->id,
            'tahun_ajaran' => $f['taBaru']->nama,
            'semester' => '2',
            'is_active_riwayat' => 'Ya',
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $aktifLain->id,
            'tahun_ajaran' => $f['taBaru']->nama,
            'semester' => '2',
            'is_active_riwayat' => 'Ya',
        ]);
        $this->assertDatabaseMissing('riwayat_belajar', [
            'santri_id' => $nonaktif->id,
            'semester' => '2',
        ]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/akademik/batal-salin-massal', [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['taBaru']->nama,
            'tingkat' => ['1'],
        ])->assertStatus(200);
        $this->assertSame(1, $res->json('berhasil'));
        $this->assertDatabaseMissing('riwayat_belajar', [
            'santri_id' => $aktif->id,
            'semester' => '2',
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'id' => $riwayatAktif->id,
            'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya',
        ]);
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $aktifLain->id,
            'semester' => '2',
            'is_active_riwayat' => 'Ya',
        ]);
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

    /** Daftar Kelulusan: kandidat genap akhir aktif + pengulang aktif TA berikut. */
    public function test_04b_daftar_kelulusan_menyaring_kandidat_dan_mengulang(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $calon = $this->makeSantri('Kandidat Lulus');
        $this->makeKeanggotaan($calon, $f['mi'], '25051');
        $this->makeRiwayat($calon, $f['taLama'], $f['mi'], '2', ['tingkat' => '6']);

        $bukanAkhir = $this->makeSantri('Bukan Tingkat Akhir');
        $this->makeKeanggotaan($bukanAkhir, $f['mi'], '25052');
        $this->makeRiwayat($bukanAkhir, $f['taLama'], $f['mi'], '2', ['tingkat' => '5']);

        $ganjil = $this->makeSantri('Akhir Ganjil');
        $this->makeKeanggotaan($ganjil, $f['mi'], '25053');
        $this->makeRiwayat($ganjil, $f['taLama'], $f['mi'], '1', ['tingkat' => '6']);

        $arsip = $this->makeSantri('Akhir Arsip');
        $this->makeKeanggotaan($arsip, $f['mi'], '25054');
        $this->makeRiwayat($arsip, $f['taLama'], $f['mi'], '2', [
            'tingkat' => '6', 'is_active_riwayat' => 'Tidak',
        ]);

        $kandidat = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/riwayat-belajar?'.http_build_query([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taLama']->nama,
            'semester' => '2', 'tingkat' => '6', 'status_akhir' => 'aktif',
            'is_active_riwayat' => 1, 'per_page' => 0,
        ]))->assertStatus(200);
        $this->assertSame(1, $kandidat->json('total'));
        $this->assertSame($calon->id, $kandidat->json('data.0.santri_id'));

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$calon->id}/tidak-lulus", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(200);

        $mengulang = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/riwayat-belajar?'.http_build_query([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['taBaru']->nama,
            'tingkat' => '6', 'status_awal' => 'mengulang',
            'is_active_riwayat' => 1, 'per_page' => 0,
        ]))->assertStatus(200);
        $this->assertSame(1, $mengulang->json('total'));
        $this->assertSame($calon->id, $mengulang->json('data.0.santri_id'));
    }

    /** Batal tidak lulus: baris mengulang dihapus, baris asal aktif kembali. */
    public function test_04c_batal_tidak_lulus_mengembalikan_baris_asal(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Batal Tidak Lulus');
        $this->makeKeanggotaan($santri, $f['mi'], '25055');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['tingkat' => '6']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/tidak-lulus", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(200);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/batal-tidak-lulus", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(200)->assertJsonPath('data.status_akhir', 'aktif');

        // Baris mengulang hilang; baris asal aktif kembali.
        $this->assertSame(1, RiwayatBelajar::where('santri_id', $santri->id)->count());
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['taLama']->nama,
            'semester' => '2', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        // Batal kedua kali → 422 jelas (tak ada hasil aktif).
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/batal-tidak-lulus", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(422);
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
        // Aksi Luluskan tanpa input penyerahan → default "Belum".
        $this->assertSame('belum', Alumni::where('santri_id', $santri->id)->value('penyerahan_ijazah'));
        $this->assertDatabaseHas('riwayat_belajar', ['santri_id' => $santri->id, 'status_akhir' => 'lulus', 'is_active_riwayat' => 'Tidak']);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'is_active_lembaga' => 'Tidak', 'tgl_selesai' => '2026-06-20']);
        $this->assertSame('Tidak', $santri->fresh()->is_active_pst);
    }

    /** Batal lulus: arsip alumni dihapus, riwayat + keanggotaan dibuka lagi. */
    public function test_05c_batal_lulus_menghapus_arsip_dan_membuka_riwayat(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantri('Batal Lulus');
        $this->makeKeanggotaan($santri, $f['mi'], '25056');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '6A', '6');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['kelas_id' => $kelas->id, 'tingkat' => '6']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_lulus' => $f['taLama']->nama,
            'tanggal_lulus' => '2026-06-20',
        ])->assertStatus(200);
        $this->assertSame(1, Alumni::count());

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/batal-lulus", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(200)->assertJsonPath('data.status_akhir', 'aktif');

        // Arsip hilang; riwayat + keanggotaan aktif kembali.
        $this->assertSame(0, Alumni::count());
        $this->assertDatabaseHas('riwayat_belajar', [
            'santri_id' => $santri->id, 'tahun_ajaran' => $f['taLama']->nama,
            'semester' => '2', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);
        $this->assertDatabaseHas('lembaga_santri', ['santri_id' => $santri->id, 'is_active_lembaga' => 'Ya']);
        $this->assertSame('Ya', $santri->fresh()->is_active_pst);

        // Batal kedua kali → 422 jelas (tak ada arsip).
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/batal-lulus", [
            'jenjang' => $f['mi']->jenjang,
        ])->assertStatus(422);
    }

    /** Koreksi alumni: field arsip bisa diubah, kunci + validasi + tenant dijaga. */
    public function test_05d_update_alumni_mengubah_field_arsip(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $mts = Lembaga::create([
            'nama' => 'Madrasah Tsanawiyah', 'jenjang' => 'MTS', 'nsm' => '123456789014',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $asing = $this->makeUser('admin', [$mts->jenjang]);
        $santri = $this->makeSantri('Koreksi Alumni');
        $this->makeKeanggotaan($santri, $f['mi'], '25057');
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '6A', '6');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['kelas_id' => $kelas->id, 'tingkat' => '6']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_lulus' => $f['taLama']->nama,
            'tanggal_lulus' => '2026-06-20',
        ])->assertStatus(200);
        $alumni = Alumni::where('santri_id', $santri->id)->firstOrFail();

        // Admin tanpa akses lembaga → 403.
        $this->actingAs($asing, 'sanctum')->putJson("/api/admin/alumni/{$alumni->id}", [
            'nomor_ijazah' => 'IJZ-X',
        ])->assertStatus(403);

        // Nilai enum salah → 422.
        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/alumni/{$alumni->id}", [
            'penyerahan_ijazah' => 'ngawur',
        ])->assertStatus(422);

        // Koreksi valid → 200 dan tersimpan.
        $this->actingAs($admin, 'sanctum')->putJson("/api/admin/alumni/{$alumni->id}", [
            'nomor_ijazah' => 'IJZ-007',
            'penyerahan_ijazah' => 'sudah',
            'tanggal_lulus' => '2026-06-21',
        ])->assertStatus(200)->assertJsonPath('data.nomor_ijazah', 'IJZ-007');
        $this->assertDatabaseHas('alumni', [
            'id' => $alumni->id, 'nomor_ijazah' => 'IJZ-007',
            'penyerahan_ijazah' => 'sudah', 'tanggal_lulus' => '2026-06-21 00:00:00',
        ]);
    }

    /** Santri boleh punya arsip alumni per lembaga (MI lalu MD = 2 baris). */
    public function test_05b_lulus_di_mi_dan_md_membuat_dua_arsip(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang, $f['md']->jenjang]);
        $santri = $this->makeSantri('Lulus Ganda');
        $this->makeKeanggotaan($santri, $f['mi'], '25007');
        $this->makeKeanggotaan($santri, $f['md'], '26007');
        $kelasMi = $this->makeKelas($f['mi'], $f['taLama'], '6A', '6');
        $kelasMd = $this->makeKelas($f['md'], $f['taBaru'], '6A', '6');
        $this->makeRiwayat($santri, $f['taLama'], $f['mi'], '2', ['kelas_id' => $kelasMi->id, 'tingkat' => '6']);
        $this->makeRiwayat($santri, $f['taBaru'], $f['md'], '2', ['kelas_id' => $kelasMd->id, 'tingkat' => '6']);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_lulus' => $f['taLama']->nama,
            'tanggal_lulus' => '2026-06-20',
            'nomor_ijazah' => 'IJZ-MI',
        ])->assertStatus(200);

        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'jenjang' => $f['md']->jenjang,
            'tahun_ajaran_lulus' => $f['taBaru']->nama,
            'tanggal_lulus' => '2027-06-20',
            'nomor_ijazah' => 'IJZ-MD',
        ])->assertStatus(200);

        $this->assertSame(2, Alumni::count());
        $this->assertDatabaseHas('alumni', [
            'santri_id' => $santri->id, 'lembaga_lulus' => 'MI', 'nomor_ijazah' => 'IJZ-MI',
        ]);
        $this->assertDatabaseHas('alumni', [
            'santri_id' => $santri->id, 'lembaga_lulus' => 'MD', 'nomor_ijazah' => 'IJZ-MD',
        ]);

        // Riwayat sudah tertutup semua → proses lulus ulang ditolak, arsip utuh.
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/santri/{$santri->id}/lulus", [
            'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran_lulus' => $f['taLama']->nama,
            'tanggal_lulus' => '2026-06-25',
            'nomor_ijazah' => 'IJZ-MI-2',
        ])->assertStatus(403);

        $this->assertSame(2, Alumni::count());
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

        // Regresi jebakan snake_case: `tahun_ajaran` per baris tetap string
        // (bukan objek relasi `tahunAjaran` yang tampil "[object Object]").
        $baris = $daftar->json('data.0');
        $this->assertSame($f['taBaru']->nama, $baris['tahun_ajaran']);
        $this->assertSame('MI', $baris['jenjang']);
        $this->assertSame('MI', $baris['lembaga']['jenjang']);

        $rekap = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/rekap-santri?jenjang='.$f['mi']->jenjang.'&tahun_ajaran='.$f['taBaru']->nama)
            ->assertStatus(200);
        $this->assertSame(2, $rekap->json('total_aktif'));
        $this->assertSame(2, $rekap->json('per_kelas.0.terisi'));
        $this->assertNotEmpty($rekap->json('usia_per_tingkat'));
        $this->assertArrayHasKey('kelompok', $rekap->json('usia_per_tingkat.0'));
    }

    // ---------- 11b. rekap santri TA historis + semester (kecuali pindah keluar) ----------

    public function test_12_rekap_santri_ta_historis_per_semester(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $kelas = $this->makeKelas($f['mi'], $f['taLama'], '2A', '2');

        // Dua lanjut (naik/lulus) + satu pindah keluar, semua semester genap TA lama.
        $lanjut = $this->makeSantri('Historis Lanjut');
        $lanjut->update(['tgl_lahir' => now()->subYears(9)->toDateString()]);
        $this->makeKeanggotaan($lanjut, $f['mi'], '26001');
        $this->makeRiwayat($lanjut, $f['taLama'], $f['mi'], '2', [
            'kelas_id' => $kelas->id, 'tingkat' => '2', 'status_akhir' => 'naik', 'is_active_riwayat' => 'Tidak',
        ]);

        $lulus = $this->makeSantri('Historis Lulus');
        $lulus->update(['tgl_lahir' => now()->subYears(12)->toDateString()]);
        $this->makeKeanggotaan($lulus, $f['mi'], '26002');
        $this->makeRiwayat($lulus, $f['taLama'], $f['mi'], '2', [
            'kelas_id' => $kelas->id, 'tingkat' => '2', 'status_akhir' => 'lulus', 'is_active_riwayat' => 'Tidak',
        ]);

        $keluar = $this->makeSantri('Historis Keluar');
        $this->makeKeanggotaan($keluar, $f['mi'], '26003');
        $this->makeRiwayat($keluar, $f['taLama'], $f['mi'], '2', [
            'kelas_id' => $kelas->id, 'tingkat' => '2', 'status_akhir' => 'pindah_keluar', 'is_active_riwayat' => 'Tidak',
        ]);

        // Dulu (filter is_active_riwayat) TA historis = 0; kini dihitung dari TA+semester.
        $rekap = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/rekap-santri?jenjang='.$f['mi']->jenjang
                .'&tahun_ajaran='.$f['taLama']->nama.'&semester=2')
            ->assertStatus(200);
        $this->assertSame(2, $rekap->json('total_aktif')); // pindah_keluar dikecualikan
        $this->assertSame(2, $rekap->json('per_kelas.0.terisi'));
        $this->assertNotEmpty($rekap->json('usia_per_tingkat'));
        $this->assertSame(
            [['tahun_ajaran' => $f['taLama']->nama, 'jumlah_riwayat_aktif' => 2, 'l' => 2, 'p' => 0]],
            $rekap->json('per_tahun_ajaran')
        );

        // Filter keaktifan: nonaktif = hanya yang pindah keluar.
        $nonaktif = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/rekap-santri?jenjang='.$f['mi']->jenjang
                .'&tahun_ajaran='.$f['taLama']->nama.'&semester=2&keaktifan=nonaktif')
            ->assertStatus(200);
        $this->assertSame(1, $nonaktif->json('total_aktif'));
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
        // `tahun_ajaran` per baris = string nama TA (bukan objek relasi).
        $this->assertContains($aktif->json('data.0.tahun_ajaran'), [$f['taBaru']->nama, $f['taLama']->nama]);

        $non = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/daftar-kelas?jenjang='.$f['mi']->jenjang.'&kelompok_status=nonaktif&lintas_periode=1')
            ->assertStatus(200);
        $namaNon = collect($non->json('data'))->pluck('santri.nama_lengkap');
        $this->assertTrue($namaNon->contains(fn ($n) => str_starts_with($n, 'Kelompok Tiga')));
        $this->assertFalse($namaNon->contains(fn ($n) => str_starts_with($n, 'Kelompok Satu')));

        // Semua = aktif + nonaktif (tanpa filter status sama sekali).
        $semua = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/akademik/daftar-kelas?jenjang='.$f['mi']->jenjang.'&kelompok_status=semua&lintas_periode=1')
            ->assertStatus(200);
        $namaSemua = collect($semua->json('data'))->pluck('santri.nama_lengkap');
        $this->assertTrue($namaSemua->contains(fn ($n) => str_starts_with($n, 'Kelompok Satu')));
        $this->assertTrue($namaSemua->contains(fn ($n) => str_starts_with($n, 'Kelompok Dua')));
        $this->assertTrue($namaSemua->contains(fn ($n) => str_starts_with($n, 'Kelompok Tiga')));
        $this->assertSame(3, $semua->json('total'));

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

    public function test_14b_daftar_kelas_urut_cari_paginasi(): void
    {
        $f = $this->baseFixture();
        $admin = $this->makeUser('admin', [$f['mi']->jenjang]);
        $kelas1 = $this->makeKelas($f['mi'], $f['taBaru'], '1A', '1');
        $kelas2 = $this->makeKelas($f['mi'], $f['taBaru'], '2A', '2');

        $sA = $this->makeSantri('Citra');
        $this->makeKeanggotaan($sA, $f['mi'], '91001');
        $this->makeRiwayat($sA, $f['taBaru'], $f['mi'], '1', ['kelas_id' => $kelas1->id, 'tingkat' => '1']);
        $sB = $this->makeSantri('Andi');
        $this->makeKeanggotaan($sB, $f['mi'], '91002');
        $this->makeRiwayat($sB, $f['taBaru'], $f['mi'], '1', ['kelas_id' => $kelas2->id, 'tingkat' => '2']);
        $sC = $this->makeSantri('Budi');
        $this->makeKeanggotaan($sC, $f['mi'], '91003');
        $this->makeRiwayat($sC, $f['taBaru'], $f['mi'], '1', ['kelas_id' => $kelas1->id, 'tingkat' => '1']);

        $dasar = '/api/admin/akademik/daftar-kelas?jenjang='.$f['mi']->jenjang;

        // Urut nama menurun + meta periode tetap ada.
        $urut = $this->actingAs($admin, 'sanctum')
            ->getJson($dasar.'&sort=santri&arah=turun')
            ->assertStatus(200);
        $nama = collect($urut->json('data'))->pluck('santri.nama_lengkap');
        $this->assertTrue(str_starts_with($nama->first(), 'Citra'));
        $this->assertTrue(str_starts_with($nama->last(), 'Andi'));
        $this->assertSame($f['taBaru']->nama, $urut->json('tahun_ajaran'));

        // Cari NIS lokal + kunci urut asing ditolak.
        $cari = $this->actingAs($admin, 'sanctum')
            ->getJson($dasar.'&q=91002')
            ->assertStatus(200);
        $this->assertSame(1, $cari->json('total'));
        $this->assertSame('91002', $cari->json('data.0.nis_lokal'));
        $this->actingAs($admin, 'sanctum')
            ->getJson($dasar.'&sort=kolom_asing')
            ->assertStatus(422);

        // Filter tingkat[] + kelas_id[] + paginasi.
        $tingkat = $this->actingAs($admin, 'sanctum')
            ->getJson($dasar.'&tingkat[]=2')
            ->assertStatus(200);
        $this->assertSame(1, $tingkat->json('total'));
        $this->assertTrue(str_starts_with($tingkat->json('data.0.santri.nama_lengkap'), 'Andi'));
        $kelas = $this->actingAs($admin, 'sanctum')
            ->getJson($dasar.'&kelas_id[]='.$kelas2->id)
            ->assertStatus(200);
        $this->assertSame(1, $kelas->json('total'));
        $halaman = $this->actingAs($admin, 'sanctum')
            ->getJson($dasar.'&per_page=2&page=2')
            ->assertStatus(200);
        $this->assertSame(3, $halaman->json('total'));
        $this->assertSame(2, $halaman->json('last_page'));
        $this->assertCount(1, $halaman->json('data'));
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
