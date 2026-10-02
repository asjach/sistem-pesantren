<?php

namespace Tests\Feature;

use App\Exports\AlumniTemplateExport;
use App\Exports\KelasTemplateExport;
use App\Exports\MutasiKeluarTemplateExport;
use App\Exports\RiwayatBelajarTemplateExport;
use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\Pegawai;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\ReferensiSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Data existing untuk dialog import dikirim backend sebagai JSON (kolom +
// wajib + baris); berkas Excel disusun di frontend. Cakupan data mengikuti
// lembaga yang boleh diakses akun.
class DataExistingJsonTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(ReferensiSeeder::class);
    }

    protected function makeUser(string $role, array $jenjangs): User
    {
        $this->seq++;
        $u = User::create([
            'name' => 'Data '.$this->seq,
            'email' => "data_u{$this->seq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9400000000 + $this->seq * 61), 10, '0', STR_PAD_LEFT),
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

    protected function fixture(): array
    {
        $mi = Lembaga::create([
            'nama' => 'Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        Lembaga::create([
            'nama' => 'Diniyah', 'jenjang' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mts = Lembaga::create([
            'nama' => 'Tsanawiyah', 'jenjang' => 'MTS',
            'is_seleksi' => true, 'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'nama' => '2026/2027', 'tanggal_mulai' => '2026-07-01',
            'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);
        // Kamus di-fan-out per lembaga → seed ulang setelah lembaga dibuat.
        $this->seed(ReferensiSeeder::class);
        DB::table('ref_status_akhir')->updateOrInsert(
            ['jenjang' => 'MI', 'kode' => 'pindah_keluar'],
            ['nama' => 'Pindah/Keluar', 'is_aktif_bawaan' => false, 'terminal_ke' => null, 'urutan' => 4, 'is_active' => true]
        );

        return compact('mi', 'mts', 'ta');
    }

    public function test_kelas_kolom_sama_template_dan_isi_nyata(): void
    {
        $f = $this->fixture();
        $pegawai = Pegawai::create([
            'jenjang' => 'MI', 'nip' => '198001012010011001', 'nama_lengkap' => 'Budi Santoso',
            'jenis_kelamin' => 'L', 'is_active' => true,
        ]);
        Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '6A',
            'tingkat' => '6', 'urutan' => 1, 'kapasitas' => 30, 'walas_id' => $pegawai->id,
        ]);
        $super = $this->makeUser('super_admin', []);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/kelas/data-existing')
            ->assertStatus(200);

        $this->assertSame(KelasTemplateExport::kolom(), $res->json('kolom'));
        $this->assertSame(KelasTemplateExport::WAJIB, $res->json('wajib'));
        $this->assertSame(
            [['MI', '2026/2027', '6A', '', $pegawai->nip, '6', '1', '30']],
            $res->json('baris')
        );
    }

    public function test_riwayat_status_dikirim_sebagai_label(): void
    {
        $f = $this->fixture();
        $santri = Santri::create(['nama_lengkap' => 'Anwar', 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => '26001',
            'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);
        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '1A', 'tingkat' => '1',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama,
            'semester' => '1', 'kelas_id' => $kelas->id, 'tgl_masuk' => '2026-07-01',
            'no_absen' => 4, 'tingkat' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya',
        ]);
        $super = $this->makeUser('super_admin', []);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/riwayat-belajar/data-existing')
            ->assertStatus(200);

        $this->assertSame(RiwayatBelajarTemplateExport::KOLOM, $res->json('kolom'));
        $this->assertSame(
            [['26001', '1', 'Anwar', 'MI', '2026/2027', '1A', '1', '2026-07-01', '4', '1', 'Santri Baru', 'Aktif']],
            $res->json('baris')
        );
    }

    public function test_mutasi_kelas_dikirim_sebagai_nama_rombel(): void
    {
        $f = $this->fixture();
        $santri = Santri::create(['nama_lengkap' => 'Siti', 'jk' => 'P']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => '26002',
            'is_active_lembaga' => 'Tidak', 'tgl_masuk' => '2015-07-01',
        ]);
        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '6B', 'tingkat' => '6',
        ]);
        MutasiKeluar::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'kelas_terakhir_id' => $kelas->id,
            'tanggal_mutasi' => null, 'alasan_mutasi' => 'SDN Contoh', 'nama_sekolah_tujuan' => 'SDN Contoh',
        ]);
        $super = $this->makeUser('super_admin', []);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/mutasi-keluar/data-existing')
            ->assertStatus(200);

        $this->assertSame(MutasiKeluarTemplateExport::kolom(), $res->json('kolom'));
        $this->assertSame(
            [['26002', 'MI', '', 'SDN Contoh', '6B', '2026/2027', '', 'SDN Contoh', '', '', '', '']],
            $res->json('baris')
        );
    }

    public function test_alumni_kelas_dikirim_sebagai_nama_rombel(): void
    {
        $f = $this->fixture();
        $santri = Santri::create(['nama_lengkap' => 'Lulus', 'jk' => 'P']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => '26004',
            'is_active_lembaga' => 'Tidak', 'tgl_masuk' => '2015-07-01',
        ]);
        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '6C', 'tingkat' => '6',
        ]);
        Alumni::create([
            'santri_id' => $santri->id, 'lembaga_lulus' => 'MI', 'tahun_ajaran_lulus' => $f['ta']->nama,
            'kelas_lulus_id' => $kelas->id, 'tanggal_lulus' => null, 'nomor_ijazah' => 'IJZ-1',
            'no_peserta' => 'PPTK-1', 'skhun' => 'SKHUN-1',
        ]);
        $super = $this->makeUser('super_admin', []);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/alumni/data-existing')
            ->assertStatus(200);

        $this->assertSame(AlumniTemplateExport::kolom(), $res->json('kolom'));
        $this->assertSame(AlumniTemplateExport::WAJIB, $res->json('wajib'));
        $baris = $res->json('baris');
        $this->assertCount(1, $baris);
        $this->assertSame('26004', $baris[0][0]);
        $this->assertSame('MI', $baris[0][1]);
        $this->assertSame($f['ta']->nama, $baris[0][2]);
        $this->assertSame('', $baris[0][3]);
        $this->assertSame('6C', $baris[0][4]);
        $this->assertSame('IJZ-1', $baris[0][5]);
    }

    public function test_data_santri_terisi_santri_id(): void
    {
        $f = $this->fixture();
        $santri = Santri::create(['nama_lengkap' => 'Rudi', 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'nis_lokal' => '26003',
            'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);
        $super = $this->makeUser('super_admin', []);

        $res = $this->actingAs($super, 'sanctum')
            ->getJson('/api/admin/santri/data-existing?jenjang[]=MI')
            ->assertStatus(200);

        $this->assertContains('santri_id', $res->json('kolom'));
        $baris = $res->json('baris');
        $this->assertCount(1, $baris);
        $this->assertSame((string) $santri->id, $baris[0][0]);
        $this->assertSame('MI', $baris[0][1]);
        $this->assertSame('26003', $baris[0][2]);
    }

    /** Cakupan mengikuti akses akun: admin MI → MI + pasangan, admin MTS → MTS. */
    public function test_cakupan_terbatas_lembaga_akses(): void
    {
        $f = $this->fixture();
        foreach ([['Mi', '26401', 'MI'], ['Md', '26402', 'MD'], ['Mts', '26403', 'MTS']] as [$nama, $nis, $jenjang]) {
            $s = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
            LembagaSantri::create([
                'santri_id' => $s->id, 'jenjang' => $jenjang, 'nis_lokal' => $nis,
                'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
            ]);
        }
        $adminMi = $this->makeUser('admin', ['MI']);
        $adminMts = $this->makeUser('admin', ['MTS']);

        $jenjang = fn (User $u) => $this->actingAs($u, 'sanctum')
            ->getJson('/api/admin/santri/data-existing')->assertStatus(200)
            ->json('baris.*.1');

        $this->assertSame(['MD', 'MI'], $jenjang($adminMi));
        $this->assertSame(['MTS'], $jenjang($adminMts));
    }
}
