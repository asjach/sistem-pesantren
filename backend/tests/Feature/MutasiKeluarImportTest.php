<?php

namespace Tests\Feature;

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
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Import arsip mutasi keluar: template + periksa + eksekusi, kunci NIS lokal +
// lembaga, kelas cukup nama, baris sama dilewati, efek meniru tombol
// "Proses mutasi" (tutup riwayat + keanggotaan aktif bila ada).
class MutasiKeluarImportTest extends TestCase
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
    }

    protected function baseFixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        $taLama = TahunAjaran::create([
            'nama' => '2025/2026',
            'tanggal_mulai' => '2025-07-01', 'tanggal_selesai' => '2026-06-30', 'is_aktif' => false,
        ]);
        foreach ([$mi->jenjang, $mts->jenjang] as $jenjang) {
            DB::table('ref_alasan_mutasi')->updateOrInsert(
                ['jenjang' => $jenjang, 'nama' => 'Ikut pindah orang tua'],
                ['urutan' => 0, 'is_active' => true]
            );
            DB::table('ref_status_akhir')->updateOrInsert(
                ['jenjang' => $jenjang, 'kode' => 'pindah_keluar'],
                ['nama' => 'Pindah/Keluar', 'is_aktif_bawaan' => false, 'terminal_ke' => null, 'urutan' => 3, 'is_active' => true]
            );
        }
        Cache::flush();
        $super = $this->makeUser('super_admin', []);

        return compact('mi', 'mts', 'ta', 'taLama', 'super');
    }

    protected function makeUser(string $role, array $jenjangs): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => 'Mutasi '.$this->userSeq,
            'email' => "mutasi_u{$this->userSeq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9400000000 + $this->userSeq * 53), 10, '0', STR_PAD_LEFT),
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

    /** Santri aktif MI: NIK 16 digit + keanggotaan + riwayat aktif sem 1. */
    protected function makeSantriAktif(array $f, string $nama, string $nik, ?Kelas $kelas = null): Santri
    {
        $this->santriSeq++;
        $santri = Santri::create(['nama_lengkap' => $nama.' '.$this->santriSeq, 'jk' => 'L', 'nik' => $nik]);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang,
            'nis_lokal' => 'NIS'.$this->santriSeq, 'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2025-07-01',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'jenjang' => $f['mi']->jenjang,
            'tahun_ajaran' => $f['ta']->nama, 'semester' => '1', 'kelas_id' => $kelas?->id,
            'tingkat' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya',
        ]);

        return $santri;
    }

    /** NIS lokal santri (kunci import). */
    protected function nisOf(Santri $santri): string
    {
        return (string) LembagaSantri::where('santri_id', $santri->id)->firstOrFail()->nis_lokal;
    }

    protected function makeCsv(array $rows): string
    {
        $headers = ['nis_lokal', 'jenjang', 'tanggal_mutasi', 'alasan_mutasi', 'kelas_terakhir', 'tahun_ajaran', 'no_surat', 'nama_sekolah_tujuan', 'npsn_sekolah_tujuan', 'nsm_sekolah_tujuan', 'alamat_sekolah_tujuan', 'keterangan'];
        $tmp = tempnam(sys_get_temp_dir(), 'mutasi').'.csv';
        $h = fopen($tmp, 'w');
        fputcsv($h, $headers);
        foreach ($rows as $r) {
            $line = [];
            foreach ($headers as $col) {
                $line[] = $r[$col] ?? '';
            }
            fputcsv($h, $line);
        }
        fclose($h);

        return $tmp;
    }

    protected function upload(User $admin, string $csvPath, string $endpoint = 'import')
    {
        return $this->actingAs($admin, 'sanctum')->post("/api/admin/mutasi-keluar/{$endpoint}", [
            'file' => new UploadedFile($csvPath, 'mutasi.csv', 'text/csv', null, true),
        ]);
    }

    public function test_01_template_bisa_diunduh(): void
    {
        $f = $this->baseFixture();

        $res = $this->actingAs($f['super'], 'sanctum')->get('/api/admin/mutasi-keluar/import-template');
        $res->assertStatus(200);
        $this->assertStringContainsString('attachment', (string) $res->headers->get('content-disposition'));
    }

    public function test_02_import_menulis_arsip_dan_menutup_aktif(): void
    {
        $f = $this->baseFixture();
        $kelas = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama,
            'nama_kelas' => '1A', 'tingkat' => '1',
        ]);
        $santri = $this->makeSantriAktif($f, 'Arsip Tulis', '1101010000000311', $kelas);
        $csv = $this->makeCsv([[
            'nis_lokal' => $this->nisOf($santri), 'jenjang' => 'MI',
            'tanggal_mutasi' => '2026-05-01', 'alasan_mutasi' => 'Ikut pindah orang tua',
            'kelas_terakhir' => '1A', 'nama_sekolah_tujuan' => 'SDN Contoh',
        ]]);

        // Dry-run tak menulis.
        $periksa = $this->upload($f['super'], $csv, 'import-periksa')->assertStatus(200);
        $this->assertTrue((bool) $periksa->json('siap_import'));
        $this->assertSame(1, (int) $periksa->json('ringkasan.dibuat'));
        $this->assertSame(0, MutasiKeluar::count());

        $res = $this->upload($f['super'], $csv)->assertStatus(200);
        $this->assertStringContainsString('1 arsip dibuat', (string) $res->json('pesan'));
        $this->assertDatabaseHas('mutasi_keluar', [
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'kelas_terakhir_id' => $kelas->id,
            'alasan_mutasi' => 'Ikut pindah orang tua', 'nama_sekolah_tujuan' => 'SDN Contoh',
        ]);
        // Efek live: riwayat + keanggotaan tertutup.
        $this->assertSame('Tidak', RiwayatBelajar::where('santri_id', $santri->id)->firstOrFail()->is_active_riwayat);
        $this->assertSame('pindah_keluar', RiwayatBelajar::where('santri_id', $santri->id)->firstOrFail()->status_akhir);
        $this->assertSame('Tidak', LembagaSantri::where('santri_id', $santri->id)->firstOrFail()->is_active_lembaga);
    }

    public function test_03_baris_sama_dilewati_dan_nonaktif_hanya_arsip(): void
    {
        $f = $this->baseFixture();
        $santri = $this->makeSantriAktif($f, 'Arsip Ganda', '1101010000000312');
        $baris = [
            'nis_lokal' => $this->nisOf($santri), 'jenjang' => 'MI',
            'tanggal_mutasi' => '2026-05-01', 'alasan_mutasi' => 'Ikut pindah orang tua',
        ];
        $csv = $this->makeCsv([$baris]);

        $this->upload($f['super'], $csv)->assertStatus(200);
        $this->assertSame(1, MutasiKeluar::where('santri_id', $santri->id)->count());

        // Import ulang file yang sama: dilewati, bukan ganda.
        $ulang = $this->upload($f['super'], $csv)->assertStatus(200);
        $this->assertSame(1, (int) $ulang->json('ringkasan.dilewati'));
        $this->assertSame(1, MutasiKeluar::where('santri_id', $santri->id)->count());
    }

    public function test_04_fallback_nis_lokal_dan_kelas_beku_otomatis(): void
    {
        $f = $this->baseFixture();
        $kelas = Kelas::create([
            'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $f['ta']->nama,
            'nama_kelas' => '1B', 'tingkat' => '1',
        ]);
        $santri = $this->makeSantriAktif($f, 'Arsip Nislok', '1101010000000313', $kelas);
        $nis = LembagaSantri::where('santri_id', $santri->id)->firstOrFail()->nis_lokal;
        $csv = $this->makeCsv([[
            'nis_lokal' => $nis, 'jenjang' => 'MI',
            'tanggal_mutasi' => '2026-05-02', 'alasan_mutasi' => 'Ikut pindah orang tua',
        ]]);

        $this->upload($f['super'], $csv)->assertStatus(200);
        // Kelas kosong → beku dari riwayat terakhir (pola live).
        $this->assertDatabaseHas('mutasi_keluar', ['santri_id' => $santri->id, 'kelas_terakhir_id' => $kelas->id]);
    }

    public function test_05_nama_kelas_ganda_wajib_tahun_ajaran(): void
    {
        $f = $this->baseFixture();
        foreach ([$f['ta']->nama, $f['taLama']->nama] as $ta) {
            Kelas::create([
                'jenjang' => $f['mi']->jenjang, 'tahun_ajaran' => $ta,
                'nama_kelas' => '1C', 'tingkat' => '1',
            ]);
        }
        $santri = $this->makeSantriAktif($f, 'Arsip Ganda Kelas', '1101010000000314');
        $dasar = [
            'nis_lokal' => $this->nisOf($santri), 'jenjang' => 'MI',
            'tanggal_mutasi' => '2026-05-01', 'alasan_mutasi' => 'Ikut pindah orang tua',
            'kelas_terakhir' => '1C',
        ];

        // Tanpa TA: gagal dengan pesan yang mengarahkan.
        $gagal = $this->upload($f['super'], $this->makeCsv([$dasar]))->assertStatus(422);
        $this->assertSame('kelas_terakhir', $gagal->json('errors.0.attribute'));
        $this->assertStringContainsString('tahun_ajaran', (string) $gagal->json('errors.0.errors.0'));
        $this->assertSame(0, MutasiKeluar::where('santri_id', $santri->id)->count());

        // Dengan TA: lolos ke kelas TA tersebut.
        $this->upload($f['super'], $this->makeCsv([$dasar + ['tahun_ajaran' => '2025/2026']]))->assertStatus(200);
        $arsip = MutasiKeluar::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame('2025/2026', Kelas::find($arsip->kelas_terakhir_id)->tahun_ajaran);
    }

    public function test_06_galat_per_baris_tak_dikenal_luar_lingkup_alasan(): void
    {
        $f = $this->baseFixture();
        $adminMi = $this->makeUser('admin', [$f['mi']->jenjang]);
        $santri = $this->makeSantriAktif($f, 'Arsip Alasan', '1101010000000315');
        $csv = $this->makeCsv([
            // Santri tak dikenal.
            ['nis_lokal' => 'NIS-TAK-ADA', 'jenjang' => 'MI', 'tanggal_mutasi' => '2026-05-01', 'alasan_mutasi' => 'Ikut pindah orang tua'],
            // Di luar lingkup akun.
            ['nis_lokal' => 'NIS-LUAR', 'jenjang' => 'MTS', 'tanggal_mutasi' => '2026-05-01', 'alasan_mutasi' => 'Ikut pindah orang tua'],
            // Alasan tak aktif (santri nyata agar sampai ke cek alasan).
            ['nis_lokal' => $this->nisOf($santri), 'jenjang' => 'MI', 'tanggal_mutasi' => '2026-05-01', 'alasan_mutasi' => 'Alasan Fiktif'],
        ]);

        $res = $this->upload($adminMi, $csv)->assertStatus(422);
        $atribut = collect($res->json('errors'))->pluck('attribute')->all();
        $this->assertSame(['nis_lokal', 'jenjang', 'alasan_mutasi'], $atribut);
        $this->assertSame(0, MutasiKeluar::count());
    }
}
