<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\ImportSesi;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\ReferensiSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Import bertahap arsip mutasi keluar + alumni (potongan JSON 1000 baris):
// periksa kering tanpa menulis, eksekusi menulis per potongan, efek mutasi
// meniru tombol "Proses mutasi" (tutup riwayat + keanggotaan), alumni
// idempoten, dan galat CSV sesi bisa diunduh.
class ImportPotongSiklusTest extends TestCase
{
    use RefreshDatabase;

    protected int $userSeq = 0;

    protected int $santriSeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(ReferensiSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
        // Id sesi mulai dari 1 di tiap tes → berkas galat lama tak boleh bocor.
        foreach (glob(storage_path('app/imports/galat-*.csv')) ?: [] as $berkas) {
            @unlink($berkas);
        }
    }

    protected function baseFixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $ta->nama, 'nama_kelas' => '6A', 'tingkat' => '6',
        ]);
        DB::table('ref_alasan_mutasi')->updateOrInsert(
            ['jenjang' => 'MI', 'nama' => 'pindah'],
            ['urutan' => 0, 'is_active' => true]
        );
        DB::table('ref_status_akhir')->updateOrInsert(
            ['jenjang' => 'MI', 'kode' => 'pindah_keluar'],
            ['nama' => 'Pindah/Keluar', 'is_aktif_bawaan' => false, 'terminal_ke' => null, 'urutan' => 3, 'is_active' => true]
        );
        DB::table('ref_status_akhir')->updateOrInsert(
            ['jenjang' => 'MI', 'kode' => 'lulus'],
            ['nama' => 'Lulus', 'is_aktif_bawaan' => false, 'terminal_ke' => null, 'urutan' => 4, 'is_active' => true]
        );
        Cache::flush();
        $super = $this->makeUser('super_admin', []);

        return compact('mi', 'ta', 'kelas', 'super');
    }

    protected function makeUser(string $role, array $jenjangs): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Siklus '.$this->userSeq,
            'email' => "siklus_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9700000000 + $this->userSeq * 83), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($jenjangs as $j) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $j,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    /** Santri + keanggotaan aktif + riwayat aktif (meniruSantri nyata). */
    protected function makeSantriAktif(string $nama, string $nis, array $f): Santri
    {
        $this->santriSeq++;
        $santri = Santri::create(['nama_lengkap' => $nama.' '.$this->santriSeq, 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => $nis,
            'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama,
            'semester' => '1', 'kelas_id' => $f['kelas']->id,
            'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
        ]);

        return $santri;
    }

    protected function barisMutasi(string $nis, string $tanggal, array $tambah = []): array
    {
        return array_merge([
            'nis_lokal' => $nis, 'jenjang' => 'MI', 'tanggal_mutasi' => $tanggal,
            'alasan_mutasi' => 'pindah', 'kelas_terakhir' => '6A',
        ], $tambah);
    }

    protected function barisAlumni(string $nis, array $tambah = []): array
    {
        return array_merge([
            'nis_lokal' => $nis, 'jenjang' => 'MI', 'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => '2027-06-30', 'kelas_lulus' => '6A',
        ], $tambah);
    }

    // ---------------- Mutasi keluar ----------------

    public function test_01_mutasi_periksa_kering_tanpa_menulis(): void
    {
        $f = $this->baseFixture();
        $a = $this->makeSantriAktif('Mutasi Periksa', '28001', $f);

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'mode' => 'periksa',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->barisMutasi('28001', '2027-01-10'),
                $this->barisMutasi('28999', '2027-01-11'),
            ],
        ])->assertStatus(200);

        $this->assertSame(2, $res->json('offset'));
        $this->assertTrue((bool) $res->json('selesai'));
        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame(0, MutasiKeluar::count());
        // Kering: riwayat & keanggotaan tak ditutup.
        $this->assertSame('aktif', RiwayatBelajar::where('santri_id', $a->id)->value('status_akhir'));
        $this->assertSame('Ya', LembagaSantri::where('santri_id', $a->id)->value('is_active_lembaga'));

        $galat = $this->actingAs($f['super'], 'sanctum')
            ->get("/api/admin/mutasi-keluar/import-potong/{$res->json('sesi_id')}/galat");
        $galat->assertStatus(200);
        $this->assertStringContainsString('28999', $galat->streamedContent() ?: '');
    }

    public function test_02_mutasi_eksekusi_menutup_riwayat_dan_idempoten(): void
    {
        $f = $this->baseFixture();
        $a = $this->makeSantriAktif('Mutasi Jalur', '28002', $f);
        $b = $this->makeSantriAktif('Mutasi.extern', '28003', $f);

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'mode' => 'eksekusi',
            'total' => 3,
            'baris' => [$this->barisMutasi('28002', '2027-01-10')],
        ])->assertStatus(200);
        $this->assertFalse((bool) $satu->json('selesai'));
        $this->assertSame(1, MutasiKeluar::count());
        $this->assertSame('pindah_keluar', RiwayatBelajar::where('santri_id', $a->id)->value('status_akhir'));
        $this->assertSame('Tidak', RiwayatBelajar::where('santri_id', $a->id)->value('is_active_riwayat'));
        $this->assertSame('Tidak', LembagaSantri::where('santri_id', $a->id)->value('is_active_lembaga'));

        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'sesi_id' => $satu->json('sesi_id'),
            'mode' => 'eksekusi',
            'terakhir' => true,
            'baris' => [
                $this->barisMutasi('28002', '2027-01-10'),
                $this->barisMutasi('28003', '2027-01-12'),
            ],
        ])->assertStatus(200);

        $this->assertSame(2, $dua->json('ringkasan.dibuat'));
        $this->assertSame(1, $dua->json('ringkasan.baris_dilewati'));
        $this->assertSame(2, MutasiKeluar::count());
        // Santri kedua ikut ditutup lewat potongan kedua.
        $this->assertSame('pindah_keluar', RiwayatBelajar::where('santri_id', $b->id)->value('status_akhir'));

        // Sesi baru dengan baris identik = dilewati, tak menggandakan.
        $tiga = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$this->barisMutasi('28002', '2027-01-10')],
        ])->assertStatus(200);
        $this->assertSame(0, $tiga->json('ringkasan.dibuat'));
        $this->assertSame(1, $tiga->json('ringkasan.baris_dilewati'));
        $this->assertSame(2, MutasiKeluar::count());
    }

    public function test_03_mutasi_tanggal_tak_valid_dan_alasan_bebas_teks(): void
    {
        $f = $this->baseFixture();
        $a = $this->makeSantriAktif('Mutasi Salah', '28004', $f);

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'mode' => 'eksekusi',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->barisMutasi('28004', 'bukan-tanggal'),
                // Arsip: alasan bebas teks, tak harus ada di kamus.
                $this->barisMutasi('28004', '2027-01-10', ['alasan_mutasi' => 'SDN Meruya Utara']),
            ],
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame('tanggal_mutasi', $res->json('galat_contoh.0.kolom'));
        $this->assertSame('SDN Meruya Utara', MutasiKeluar::where('santri_id', $a->id)->value('alasan_mutasi'));
    }

    public function test_03b_alasan_lebih_dari_100_karakter_gagal(): void
    {
        $f = $this->baseFixture();
        $this->makeSantriAktif('Mutasi Alasan Panjang', '28005', $f);

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$this->barisMutasi('28005', '2027-01-10', ['alasan_mutasi' => str_repeat('a', 101)])],
        ])->assertStatus(200);

        $this->assertSame(0, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame('alasan_mutasi', $res->json('galat_contoh.0.kolom'));
        $this->assertSame(0, MutasiKeluar::count());
    }

    // ---------------- Alumni ----------------

    public function test_04_alumni_periksa_kering_tanpa_menulis(): void
    {
        $f = $this->baseFixture();
        $a = $this->makeSantriAktif('Alumni Periksa', '28101', $f);

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/alumni/import-potong', [
            'mode' => 'periksa',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->barisAlumni('28101'),
                $this->barisAlumni('28998'),
            ],
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(1, $res->json('ringkasan.baris_gagal'));
        $this->assertSame(0, Alumni::count());
        $this->assertSame('aktif', RiwayatBelajar::where('santri_id', $a->id)->value('status_akhir'));
    }

    public function test_05_alumni_eksekusi_menutup_riwayat_lalu_dilewati(): void
    {
        $f = $this->baseFixture();
        $a = $this->makeSantriAktif('Alumni Jalur', '28102', $f);

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/alumni/import-potong', [
            'mode' => 'eksekusi',
            'total' => 2,
            'baris' => [$this->barisAlumni('28102', ['nomor_ijazah' => 'IJZ-1', 'no_peserta' => 'PPTK-2027-0001', 'skhun' => 'SKHUN-2027-0001'])],
        ])->assertStatus(200);
        $this->assertFalse((bool) $satu->json('selesai'));
        $this->assertSame(1, Alumni::count());
        $this->assertSame('IJZ-1', Alumni::where('santri_id', $a->id)->value('nomor_ijazah'));
        $this->assertSame('PPTK-2027-0001', Alumni::where('santri_id', $a->id)->value('no_peserta'));
        $this->assertSame('SKHUN-2027-0001', Alumni::where('santri_id', $a->id)->value('skhun'));
        $this->assertSame('lulus', RiwayatBelajar::where('santri_id', $a->id)->value('status_akhir'));
        $this->assertSame('Tidak', LembagaSantri::where('santri_id', $a->id)->value('is_active_lembaga'));

        // Potongan kedua: isi identik → dilewati; isi berubah → diperbarui.
        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/alumni/import-potong', [
            'sesi_id' => $satu->json('sesi_id'),
            'mode' => 'eksekusi',
            'terakhir' => true,
            'baris' => [
                $this->barisAlumni('28102', ['nomor_ijazah' => 'IJZ-1', 'no_peserta' => 'PPTK-2027-0001', 'skhun' => 'SKHUN-2027-0001']),
                $this->barisAlumni('28102', ['nomor_ijazah' => 'IJZ-2', 'no_peserta' => 'PPTK-2027-0002', 'skhun' => 'SKHUN-2027-0002']),
            ],
        ])->assertStatus(200);

        $this->assertSame(1, $dua->json('ringkasan.diperbarui'));
        $this->assertSame(1, $dua->json('ringkasan.baris_dilewati'));
        $this->assertSame(1, Alumni::count());
        $this->assertSame('IJZ-2', Alumni::where('santri_id', $a->id)->value('nomor_ijazah'));
        $this->assertSame('PPTK-2027-0002', Alumni::where('santri_id', $a->id)->value('no_peserta'));
        $this->assertSame('SKHUN-2027-0002', Alumni::where('santri_id', $a->id)->value('skhun'));
    }

    // ---------------- Kunci sesi bersama ----------------

    public function test_06_batas_1000_dan_kunci_sesi_pengguna_lain(): void
    {
        $f = $this->baseFixture();
        $lain = $this->makeUser('super_admin', []);

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/alumni/import-potong', [
            'mode' => 'periksa',
            'total' => 1001,
            'baris' => array_fill(0, 1001, $this->barisAlumni('28101')),
        ])->assertStatus(422);

        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/alumni/import-potong', [
            'mode' => 'periksa',
            'total' => 2,
            'baris' => [$this->barisAlumni('28101')],
        ])->assertStatus(200);
        $this->assertSame(ImportSesi::JALAN, ImportSesi::find($dua->json('sesi_id'))->status);

        // Mode beda → 422; pengguna lain → 404.
        $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/alumni/import-potong', [
            'sesi_id' => $dua->json('sesi_id'),
            'mode' => 'eksekusi',
            'baris' => [$this->barisAlumni('28101')],
        ])->assertStatus(422);
        $this->actingAs($lain, 'sanctum')->postJson('/api/admin/alumni/import-potong', [
            'sesi_id' => $dua->json('sesi_id'),
            'mode' => 'periksa',
            'baris' => [$this->barisAlumni('28101')],
        ])->assertStatus(404);
    }

    public function test_07_izin_per_baris_di_luar_lingkup_akun(): void
    {
        $mi = Lembaga::create([
            'nama' => 'Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $admin = $this->makeUser('admin', [$mi->jenjang]);
        $santri = Santri::create(['nama_lengkap' => 'Lintas', 'jk' => 'P']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => $mts->jenjang, 'nis_lokal' => '28201',
            'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);

        $res = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/alumni/import-potong', [
            'mode' => 'eksekusi',
            'total' => 2,
            'terakhir' => true,
            'baris' => [
                $this->barisAlumni('28201', ['jenjang' => $mi->jenjang]),
                $this->barisAlumni('28201', ['jenjang' => $mts->jenjang]),
            ],
        ])->assertStatus(200);

        $this->assertSame(0, $res->json('ringkasan.dibuat'));
        $this->assertSame(2, $res->json('ringkasan.baris_gagal'));
        // Baris 1: NIS terdaftar di MTS, jenjang baris MI →xis tak ketemu.
        $this->assertSame('nis_lokal', $res->json('galat_contoh.0.kolom'));
        // Baris 2: jenjang MTS di luar lingkup akun admin MI.
        $this->assertSame('Lembaga di luar lingkup akses Anda.', $res->json('galat_contoh.1.pesan'));
        $this->assertSame(0, Alumni::count());
    }

    public function test_08_mutasi_tanggal_dan_alasan_kosong_tersimpan_null(): void
    {
        $f = $this->baseFixture();
        $a = $this->makeSantriAktif('Mutasi Tanpa Tanggal', '28301', $f);
        $baris = $this->barisMutasi('28301', '', ['alasan_mutasi' => '', 'kelas_terakhir' => '6A']);

        $satu = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$baris],
        ])->assertStatus(200);

        $this->assertSame(1, $satu->json('ringkasan.dibuat'));
        $this->assertSame(0, $satu->json('ringkasan.baris_gagal'));
        $arsip = MutasiKeluar::where('santri_id', $a->id)->first();
        $this->assertNotNull($arsip);
        $this->assertNull($arsip->tanggal_mutasi);
        $this->assertNull($arsip->alasan_mutasi);
        $this->assertSame('Tidak', LembagaSantri::where('santri_id', $a->id)->value('is_active_lembaga'));

        // Tanggal kosong = satu nilai idempotensi: baris sama dilewati.
        $dua = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$baris],
        ])->assertStatus(200);

        $this->assertSame(0, $dua->json('ringkasan.dibuat'));
        $this->assertSame(1, $dua->json('ringkasan.baris_dilewati'));
        $this->assertSame(1, MutasiKeluar::count());
    }

    public function test_09_kelas_angka_dibaca_sebagai_nama_rombel(): void
    {
        $f = $this->baseFixture();
        // id 1 dipakai kelas "6A"; kelas bernama "1" dibuat belakangan (id bukan 1).
        $satu = $this->makeSantriAktif('Kelas Angka', '28302', $f);
        $kelasSatu = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '1', 'tingkat' => '1',
        ]);
        $this->assertTrue($kelasSatu->id > 1);

        $res = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$this->barisMutasi('28302', '2027-02-01', ['kelas_terakhir' => '1', 'tahun_ajaran' => $f['ta']->nama])],
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('ringkasan.dibuat'));
        $this->assertSame(0, $res->json('ringkasan.baris_gagal'));
        $this->assertSame($kelasSatu->id, MutasiKeluar::where('santri_id', $satu->id)->value('kelas_terakhir_id'));

        // Angka yang tak pernah jadi nama rombel tetap dibaca sebagai id kelas.
        $sembilanA = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '9A', 'tingkat' => '9',
        ]);
        $dua = $this->makeSantriAktif('Kelas Id Angka', '28303', $f);
        $res2 = $this->actingAs($f['super'], 'sanctum')->postJson('/api/admin/mutasi-keluar/import-potong', [
            'mode' => 'eksekusi',
            'total' => 1,
            'terakhir' => true,
            'baris' => [$this->barisMutasi('28303', '2027-02-02', ['kelas_terakhir' => (string) $sembilanA->id])],
        ])->assertStatus(200);

        $this->assertSame(0, $res2->json('ringkasan.baris_gagal'));
        $this->assertSame($sembilanA->id, MutasiKeluar::where('santri_id', $dua->id)->value('kelas_terakhir_id'));
    }
}
