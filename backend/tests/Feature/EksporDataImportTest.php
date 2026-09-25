<?php

namespace Tests\Feature;

use App\Exports\KelasDataExport;
use App\Exports\KelasTemplateExport;
use App\Exports\MutasiKeluarDataExport;
use App\Exports\MutasiKeluarTemplateExport;
use App\Exports\RiwayatBelajarDataExport;
use App\Exports\RiwayatBelajarTemplateExport;
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
use Maatwebsite\Excel\Excel as Tipe;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use Tests\TestCase;

// Unduh data existing untuk dialog import (kelas, riwayat belajar, mutasi
// keluar): heading PERSIS sama dengan template import, isi data nyata, dan
// hanya lembaga yang boleh diakses akun.
class EksporDataImportTest extends TestCase
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
            'name' => 'Ekspor '.$this->seq,
            'email' => "ekspor_u{$this->seq}_".uniqid().'@example.com',
            'phone' => '08'.str_pad((string) (9500000000 + $this->seq * 67), 10, '0', STR_PAD_LEFT),
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

    protected function tulis(object $export): string
    {
        $path = sys_get_temp_dir().'/ekspor-data-'.uniqid().'.xlsx';
        file_put_contents($path, Excel::raw($export, Tipe::XLSX));

        return $path;
    }

    /** Round-trip kelas: heading = template, isi data nyata, walas = NIP. */
    #[RunInSeparateProcess]
    public function test_kelas_heading_sama_template_dan_isi_nyata(): void
    {
        $f = $this->fixture();
        $pegawai = Pegawai::create([
            'jenjang' => 'MI', 'nip' => '198001012010011001', 'nama_lengkap' => 'Budi Santoso',
            'jenis_kelamin' => 'L', 'is_active' => true,
        ]);
        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '6A',
            'tingkat' => '6', 'urutan' => 1, 'kapasitas' => 30, 'walas_id' => $pegawai->id,
        ]);
        $super = $this->makeUser('super_admin', []);

        $res = $this->actingAs($super, 'sanctum')->get('/api/admin/kelas/ekspor-data');
        $res->assertStatus(200);
        $this->assertStringContainsString('attachment', (string) $res->headers->get('content-disposition'));

        $path = $this->tulis(new KelasDataExport(['MI']));
        try {
            $isi = $this->bacaXlsx($path);
            $this->assertSame(KelasTemplateExport::kolom(), $isi[0]);
            $this->assertSame(
                ['MI', '2026/2027', '6A', '', $pegawai->nip, '6', '1', '30'],
                $isi[1]
            );
        } finally {
            @unlink($path);
        }
        $this->assertSame($kelas->id, $kelas->id);
    }

    #[RunInSeparateProcess]
    public function test_riwayat_heading_sama_template_dan_status_sebagai_label(): void
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

        $this->actingAs($super, 'sanctum')->get('/api/admin/riwayat-belajar/ekspor-data')->assertStatus(200);

        $path = $this->tulis(new RiwayatBelajarDataExport(['MI']));
        try {
            $isi = $this->bacaXlsx($path);
            $this->assertSame(RiwayatBelajarTemplateExport::KOLOM, $isi[0]);
            $this->assertSame(
                ['26001', 'MI', '2026/2027', '1A', '1', '2026-07-01', '4', '1', 'Santri Baru', 'Aktif'],
                $isi[1]
            );
        } finally {
            @unlink($path);
        }
    }

    #[RunInSeparateProcess]
    public function test_mutasi_heading_sama_template_dan_kelas_sebagai_nama(): void
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

        $this->actingAs($super, 'sanctum')->get('/api/admin/mutasi-keluar/ekspor-data')->assertStatus(200);

        $path = $this->tulis(new MutasiKeluarDataExport(['MI']));
        try {
            $isi = $this->bacaXlsx($path);
            $this->assertSame(MutasiKeluarTemplateExport::kolom(), $isi[0]);
            $this->assertSame(
                ['26002', 'MI', '', 'SDN Contoh', '6B', '2026/2027', '', 'SDN Contoh', '', '', '', ''],
                $isi[1]
            );
        } finally {
            @unlink($path);
        }
    }

    /** Data existing ber-style: header tebal + warna wajib/opsional, freeze,
     *  autofilter, dan zebra baris data. */
    #[RunInSeparateProcess]
    public function test_data_existing_ber_style(): void
    {
        $f = $this->fixture();
        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '6A', 'tingkat' => '6',
        ]);
        Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '6B', 'tingkat' => '6',
        ]);
        $super = $this->makeUser('super_admin', []);

        $this->actingAs($super, 'sanctum')->get('/api/admin/kelas/ekspor-data')->assertStatus(200);

        $path = $this->tulis(new KelasDataExport(['MI']));
        try {
            $sheet = IOFactory::load($path)->getActiveSheet();
            // Wajib = kuning, opsional = biru.
            $this->assertSame('FFFFE699', $sheet->getStyle('A1')->getFill()->getStartColor()->getARGB());
            $this->assertSame('FFDCE6F1', $sheet->getStyle('D1')->getFill()->getStartColor()->getARGB());
            $this->assertTrue($sheet->getStyle('A1')->getFont()->getBold());
            $this->assertSame('A2', $sheet->getTopLeftCell());
            $this->assertSame('A1:H1', $sheet->getAutoFilter()->getRange());
            // Baris data: border tipis + zebra (baris genap diberi arang muda).
            $this->assertSame('FFE5E7EB', $sheet->getStyle('A2')->getBorders()->getLeft()->getColor()->getARGB());
            $this->assertSame('FFF8FAFC', $sheet->getStyle('A2')->getFill()->getStartColor()->getARGB());
            $this->assertSame(3, $sheet->getHighestRow());
        } finally {
            @unlink($path);
        }
    }

    /** Admin lembaga hanya melihat data miliknya; akun tanpa izin dapat 403. */
    public function test_ekspor_dibatasi_lembaga_dan_izin(): void
    {
        $f = $this->fixture();
        $santri = Santri::create(['nama_lengkap' => 'Rudi', 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MTS', 'nis_lokal' => '26003',
            'is_active_lembaga' => 'Ya', 'tgl_masuk' => '2026-07-01',
        ]);
        $kelasMts = Kelas::create([
            'jenjang' => 'MTS', 'tahun_ajaran' => $f['ta']->nama, 'nama_kelas' => '7A', 'tingkat' => '7',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'jenjang' => 'MTS', 'tahun_ajaran' => $f['ta']->nama,
            'semester' => '1', 'kelas_id' => $kelasMts->id, 'status_akhir' => 'aktif',
            'is_active_riwayat' => 'Ya',
        ]);
        $admin = $this->makeUser('admin', ['MI']);

        $path = $this->tulis(new RiwayatBelajarDataExport($this->jenjangAksesibel($admin)));
        try {
            $isi = $this->bacaXlsx($path);
            // Hanya baris MI (tak ada) — data MTS tak bocor.
            $this->assertSame([RiwayatBelajarTemplateExport::KOLOM], $isi);
        } finally {
            @unlink($path);
        }

        $this->actingAs($admin, 'sanctum')->get('/api/admin/riwayat-belajar/ekspor-data')->assertStatus(200);
    }

    /** @return list<string> */
    protected function jenjangAksesibel(User $user): array
    {
        return $user->bolehPesantren()
            ? DB::table('lembaga')->orderBy('jenjang')->pluck('jenjang')->map(fn ($v) => (string) $v)->all()
            : array_values(array_map('strval', $user->lembagaIdsDenganPasangan()));
    }

    protected function bacaXlsx(string $path): array
    {
        $sheet = IOFactory::load($path)->getActiveSheet();
        $baris = $sheet->toArray();
        // Buang baris kosong di ekor.
        while ($baris !== [] && count(array_filter($baris[count($baris) - 1], fn ($v) => $v === null || $v === '')) === count($baris[count($baris) - 1])) {
            array_pop($baris);
        }

        return array_map(
            fn ($b) => array_map(fn ($v) => $v === null ? '' : (string) $v, array_values($b)),
            $baris
        );
    }
}
