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

    /** Kunci baris = NIS lokal + jenjang: satu Santri boleh punya arsip per lembaga. */
    public function test_satu_santri_punya_arsip_per_lembaga(): void
    {
        $f = $this->fixture();
        $md = Lembaga::create([
            'nama' => 'Madrasah Diniyah', 'jenjang' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $kelasMd = Kelas::create([
            'jenjang' => $md->jenjang, 'tahun_ajaran' => $f['tahun']->nama,
            'nama_kelas' => '6A', 'tingkat' => '6',
        ]);
        $santri = Santri::create(['nama_lengkap' => 'Lulus Ganda', 'jk' => 'P', 'nik' => '1101010000000888']);
        foreach ([['MI', '26011'], ['MD', '26011']] as [$jenjang, $nis]) {
            LembagaSantri::create([
                'santri_id' => $santri->id, 'jenjang' => $jenjang, 'nis_lokal' => $nis,
                'is_active_lembaga' => 'Tidak', 'tgl_masuk' => '2015-07-01',
            ]);
        }

        $miCsv = $this->csv([
            'nis_lokal' => '26011', 'jenjang' => 'MI', 'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => '2027-06-30', 'kelas_lulus' => '6A', 'nomor_ijazah' => 'IJZ-MI',
        ]);
        $this->upload($f['user'], $miCsv, 'import')->assertStatus(200);
        $mdCsv = $this->csv([
            'nis_lokal' => '26011', 'jenjang' => 'MD', 'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => '2027-06-30', 'kelas_lulus' => '6A', 'nomor_ijazah' => 'IJZ-MD',
        ]);
        $this->upload($f['user'], $mdCsv, 'import')->assertStatus(200);

        $this->assertSame(2, Alumni::count());
        $this->assertSame(['MD', 'MI'], Alumni::orderBy('lembaga_lulus')->pluck('lembaga_lulus')->all());
        $this->assertSame($kelasMd->id, Alumni::where('lembaga_lulus', 'MD')->value('kelas_lulus_id'));

        // Update hanya menyentuh arsip lembaga yang sama.
        $miCsv2 = $this->csv([
            'nis_lokal' => '26011', 'jenjang' => 'MI', 'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => '2027-06-30', 'kelas_lulus' => '6A', 'nomor_ijazah' => 'IJZ-MI-2',
        ]);
        $res = $this->upload($f['user'], $miCsv2, 'import')->assertStatus(200);
        $this->assertSame(0, (int) $res->json('ringkasan.dibuat'));
        $this->assertSame(1, (int) $res->json('ringkasan.diperbarui'));
        $this->assertSame(2, Alumni::count());
        $this->assertSame('IJZ-MI-2', Alumni::where('lembaga_lulus', 'MI')->value('nomor_ijazah'));
        $this->assertSame('IJZ-MD', Alumni::where('lembaga_lulus', 'MD')->value('nomor_ijazah'));
    }

    public function test_tanggal_lulus_kosong_disimpan_null_dan_dilewati_ulang(): void
    {
        $f = $this->fixture();
        $santri = $this->makeSantri($f);
        $path = $this->csv([
            'nis_lokal' => 'NIS-ALUMNI-001',
            'jenjang' => 'MI',
            'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => '',
            'kelas_lulus' => '6A',
        ]);

        $periksa = $this->upload($f['user'], $path, 'import-periksa')->assertStatus(200);
        $this->assertSame(1, (int) $periksa->json('ringkasan.dibuat'));
        $this->assertSame(0, (int) $periksa->json('ringkasan.gagal'));
        $this->assertSame(0, Alumni::count());

        $this->upload($f['user'], $path, 'import')->assertStatus(200);
        $arsip = Alumni::where('santri_id', $santri->id)->firstOrFail();
        $this->assertNull($arsip->tanggal_lulus);

        // Import ulang baris kosong yang sama → dilewati (bukan diperbarui).
        $ulang = $this->upload($f['user'], $path, 'import')->assertStatus(200);
        $this->assertSame(1, (int) $ulang->json('ringkasan.dilewati'));
        $this->assertSame(0, (int) $ulang->json('ringkasan.diperbarui'));
        $this->assertSame(1, Alumni::count());
    }

    public function test_tgl_selesai_keanggotaan_diisi_walau_santri_sudah_nonaktif(): void
    {
        $f = $this->fixture();
        // Santri tak aktif (keanggotaan + riwayat sudah nonaktif) — kasus arsip historis.
        $santri = $this->makeSantri($f, false);
        $path = $this->csv([
            'nis_lokal' => 'NIS-ALUMNI-001',
            'jenjang' => 'MI',
            'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => '2027-06-30',
            'kelas_lulus' => '6A',
        ]);

        $this->upload($f['user'], $path, 'import')->assertStatus(200);

        $keanggotaan = LembagaSantri::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame('Tidak', $keanggotaan->is_active_lembaga);
        $this->assertSame('2027-06-30', $keanggotaan->tgl_selesai?->format('Y-m-d'));
    }

    public function test_tanggal_kosong_tak_menghapus_tgl_selesai_lama(): void
    {
        $f = $this->fixture();
        $santri = $this->makeSantri($f, false);
        LembagaSantri::where('santri_id', $santri->id)->update(['tgl_selesai' => '2015-06-30']);
        $path = $this->csv([
            'nis_lokal' => 'NIS-ALUMNI-001',
            'jenjang' => 'MI',
            'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => '',
            'kelas_lulus' => '6A',
        ]);

        $this->upload($f['user'], $path, 'import')->assertStatus(200);

        $this->assertSame('Tidak', LembagaSantri::where('santri_id', $santri->id)->value('is_active_lembaga'));
        $this->assertSame('2015-06-30', LembagaSantri::where('santri_id', $santri->id)->value('tgl_selesai')?->format('Y-m-d'));
    }

    public function test_tanggal_lulus_terisi_tapi_tak_valid_gagal(): void
    {
        $f = $this->fixture();
        $this->makeSantri($f);
        $path = $this->csv([
            'nis_lokal' => 'NIS-ALUMNI-001',
            'jenjang' => 'MI',
            'tahun_ajaran_lulus' => '2026/2027',
            'tanggal_lulus' => 'bukan-tanggal',
            'kelas_lulus' => '6A',
        ]);

        $res = $this->upload($f['user'], $path, 'import')->assertStatus(422);
        $this->assertSame('tanggal_lulus', collect($res->json('errors'))->pluck('attribute')->first());
        $this->assertSame(0, Alumni::count());
    }
}
