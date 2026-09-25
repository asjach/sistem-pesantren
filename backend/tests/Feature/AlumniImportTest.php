<?php

namespace Tests\Feature;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

class AlumniImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    protected function fixture(): array
    {
        $lembaga = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah',
            'jenjang' => 'MI',
            'is_seleksi' => false,
            'kelompok_psb' => 'combo_mi_md',
            'is_active' => true,
        ]);
        $tahun = TahunAjaran::create([
            'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01',
            'tanggal_selesai' => '2027-06-30',
            'is_aktif' => true,
        ]);
        $kelas = Kelas::create([
            'jenjang' => $lembaga->jenjang,
            'tahun_ajaran' => $tahun->nama,
            'nama_kelas' => '6A',
            'tingkat' => '6',
        ]);
        $user = User::create([
            'name' => 'Admin Import',
            'email' => 'alumni-import@example.com',
            'password' => 'password',
        ]);
        $user->assignRole('super_admin');

        return compact('lembaga', 'tahun', 'kelas', 'user');
    }

    protected function makeSantri(array $f, bool $aktif = true): Santri
    {
        $santri = Santri::create([
            'nama_lengkap' => 'Santri Import',
            'jk' => 'L',
            'nik' => '1101010000000999',
        ]);
        LembagaSantri::create([
            'santri_id' => $santri->id,
            'jenjang' => $f['lembaga']->jenjang,
            'nis_lokal' => 'NIS-ALUMNI-001',
            'is_active_lembaga' => $aktif ? 'Ya' : 'Tidak',
            'tgl_masuk' => '2025-07-01',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id,
            'jenjang' => $f['lembaga']->jenjang,
            'tahun_ajaran' => $f['tahun']->nama,
            'semester' => '2',
            'kelas_id' => $f['kelas']->id,
            'tingkat' => '6',
            'status_awal' => 'lulus',
            'status_akhir' => $aktif ? 'aktif' : 'lulus',
            'is_active_riwayat' => $aktif ? 'Ya' : 'Tidak',
        ]);

        return $santri;
    }

    protected function csv(array $row): string
    {
        $headers = [
            'nis_lokal', 'jenjang', 'tahun_ajaran_lulus', 'tanggal_lulus', 'kelas_lulus',
            'nomor_ijazah', 'no_peserta', 'skhun', 'no_surat_ijazah', 'kegiatan_setelah_lulus', 'penyerahan_ijazah',
            'melanjutkan', 'catatan',
        ];
        $path = tempnam(sys_get_temp_dir(), 'alumni').'.csv';
        $handle = fopen($path, 'w');
        fputcsv($handle, $headers);
        fputcsv($handle, array_map(fn (string $column) => (string) ($row[$column] ?? ''), $headers));
        fclose($handle);

        return $path;
    }

    protected function upload(User $user, string $path, string $endpoint): mixed
    {
        return $this->actingAs($user, 'sanctum')->post("/api/admin/alumni/{$endpoint}", [
            'file' => new UploadedFile($path, 'alumni.csv', 'text/csv', null, true),
        ]);
    }

    public function test_template_dan_dry_run_tidak_menulis(): void
    {
        $f = $this->fixture();
        $santri = $this->makeSantri($f);
        $path = $this->csv([
            'nis_lokal' => 'NIS-ALUMNI-001',
            'jenjang' => 'MI',
            'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => '2027-06-30',
            'kelas_lulus' => '6A',
            'no_peserta' => 'PPTK-2027-0001',
            'skhun' => 'SKHUN-2027-0001',
        ]);

        $template = $this->actingAs($f['user'], 'sanctum')->get('/api/admin/alumni/import-template');
        $template->assertStatus(200);
        $this->assertStringContainsString('attachment', (string) $template->headers->get('content-disposition'));

        $periksa = $this->upload($f['user'], $path, 'import-periksa')->assertStatus(200);
        $this->assertTrue((bool) $periksa->json('siap_import'));
        $this->assertSame(1, (int) $periksa->json('ringkasan.dibuat'));
        $this->assertSame(0, Alumni::count());

        $res = $this->upload($f['user'], $path, 'import')->assertStatus(200);
        $this->assertStringContainsString('1 arsip dibuat', (string) $res->json('pesan'));
        $this->assertDatabaseHas('alumni', [
            'santri_id' => $santri->id,
            'lembaga_lulus' => 'MI',
            'kelas_lulus_id' => $f['kelas']->id,
            'tahun_ajaran_lulus' => '2026/2027',
            'no_peserta' => 'PPTK-2027-0001',
            'skhun' => 'SKHUN-2027-0001',
        ]);
        $this->assertSame('Tidak', RiwayatBelajar::where('santri_id', $santri->id)->value('is_active_riwayat'));
    }

    public function test_import_ulang_dilewati(): void
    {
        $f = $this->fixture();
        $this->makeSantri($f, false);
        $path = $this->csv([
            'nis_lokal' => 'NIS-ALUMNI-001',
            'jenjang' => 'MI',
            'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => '2027-06-30',
            'kelas_lulus' => '6A',
        ]);

        $this->upload($f['user'], $path, 'import')->assertStatus(200);
        $ulang = $this->upload($f['user'], $path, 'import')->assertStatus(200);
        $this->assertSame(1, (int) $ulang->json('ringkasan.dilewati'));
        $this->assertSame(1, Alumni::count());
    }
}
