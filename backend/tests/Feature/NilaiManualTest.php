<?php

namespace Tests\Feature;

use App\Models\KegiatanEvaluatif;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\MataPelajaran;
use App\Models\NilaiSantri;
use App\Models\PengampuMapel;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

/** Input manual satu sel nilai akhir di Leger. */
class NilaiManualTest extends TestCase
{
    use RefreshDatabase;

    private const TA = '2026/2027';

    private User $admin;

    private KegiatanEvaluatif $kegiatanEvaluatif;

    private Santri $santri;

    private MataPelajaran $mapel;

    private function setUpDasar(): void
    {
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'is_seleksi' => false,
            'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        $this->admin = User::create([
            'name' => 'Admin Nilai', 'email' => 'admin-nilai@example.com',
            'phone' => '081444444444', 'password' => 'password',
        ]);
        $this->admin->assignRole('super_admin');

        $kelas = Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'nama_kelas' => '6A', 'tingkat' => '6',
        ]);
        $this->santri = Santri::create(['nama_lengkap' => 'Santri Manual', 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $this->santri->id, 'jenjang' => 'MI', 'nis_lokal' => '99001', 'is_active_lembaga' => 'Ya',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $this->santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'semester' => '1',
            'kelas_id' => $kelas->id, 'tingkat' => '6',
            'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_active_riwayat' => RiwayatBelajar::YA,
        ]);
        $this->mapel = MataPelajaran::create([
            'jenjang' => 'MI', 'nama_mapel' => 'Fiqih', 'kelompok' => 'formal',
        ]);
        PengampuMapel::create(['kelas_id' => $kelas->id, 'mata_pelajaran_id' => $this->mapel->id]);
        $this->kegiatanEvaluatif = KegiatanEvaluatif::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'kode' => 'ASAS',
            'nama' => 'Asesmen Sumatif Akhir Semester', 'cakupan' => 'semua',
            'kurikulum' => 'keduanya', 'jenis_rapor' => 'akhir', 'urutan' => 1, 'is_active' => true,
        ]);
    }

    public function test_nilai_manual_tersimpan_dengan_sumber_manual(): void
    {
        $this->setUpDasar();

        $this->simpan(88.5)
            ->assertOk()
            ->assertJsonPath('sel.sumber', NilaiSantri::MANUAL)
            ->assertJsonPath('sel.nilai', 88.5);

        $this->assertDatabaseHas('nilai_santri', [
            'santri_id' => $this->santri->id,
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
            'semester' => '1',
            'nilai_akhir' => 88.5,
            'sumber' => NilaiSantri::MANUAL,
        ]);
    }

    public function test_nilai_nol_tetap_disimpan_sebagai_nilai(): void
    {
        $this->setUpDasar();

        $this->simpan(0)->assertOk();

        $this->assertDatabaseHas('nilai_santri', [
            'santri_id' => $this->santri->id,
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
            'nilai_akhir' => 0,
            'sumber' => NilaiSantri::MANUAL,
        ]);
    }

    public function test_sel_kosong_menghapus_nilai(): void
    {
        $this->setUpDasar();
        $this->simpan(75)->assertOk();

        $this->simpan(null)->assertOk()->assertJsonPath('sel', null);

        $this->assertDatabaseMissing('nilai_santri', [
            'santri_id' => $this->santri->id,
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
        ]);
    }

    public function test_nilai_manual_mengikuti_rentang_0_10(): void
    {
        $this->setUpDasar();
        $this->kegiatanEvaluatif->update(['rentang_nilai' => '0-10']);

        $this->simpan(10)->assertOk();
        $this->assertDatabaseHas('nilai_santri', [
            'santri_id' => $this->santri->id,
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
            'nilai_akhir' => 10,
            'sumber' => NilaiSantri::MANUAL,
        ]);

        $this->simpan(10.5)->assertUnprocessable()->assertJsonValidationErrors('nilai_akhir');
        $this->simpan(-0.5)->assertUnprocessable()->assertJsonValidationErrors('nilai_akhir');
    }

    public function test_nilai_manual_mengikuti_rentang_0_4(): void
    {
        $this->setUpDasar();
        $this->kegiatanEvaluatif->update(['rentang_nilai' => '0-4']);

        $this->simpan(4)->assertOk();
        $this->assertDatabaseHas('nilai_santri', [
            'santri_id' => $this->santri->id,
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
            'nilai_akhir' => 4,
            'sumber' => NilaiSantri::MANUAL,
        ]);

        $this->simpan(4.5)->assertUnprocessable()->assertJsonValidationErrors('nilai_akhir');
    }

    public function test_nilai_di_luar_rentang_ditolak(): void
    {
        $this->setUpDasar();
        $this->assertSame('0-100', $this->kegiatanEvaluatif->fresh()->rentang_nilai);

        $this->simpan(101)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('nilai_akhir');
    }

    public function test_mapel_tanpa_pengampu_ditolak(): void
    {
        $this->setUpDasar();
        $mapelLain = MataPelajaran::create([
            'jenjang' => 'MI', 'nama_mapel' => 'Mapel Tanpa Pengampu', 'kelompok' => 'formal',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/penilaian/nilai', [
                'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
                'semester' => '1',
                'santri_id' => $this->santri->id,
                'mapel_id' => $mapelLain->id,
                'nilai_akhir' => 80,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('mapel_id');
    }

    public function test_hitung_ulang_melewati_nilai_manual(): void
    {
        $this->setUpDasar();
        $this->simpan(88)->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/penilaian/hitung', [
                'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
                'semester' => '1',
            ])
            ->assertOk()
            ->assertJsonPath('dilewati_impor', 1);

        $this->assertDatabaseHas('nilai_santri', [
            'santri_id' => $this->santri->id,
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
            'nilai_akhir' => 88,
            'sumber' => NilaiSantri::MANUAL,
        ]);
    }

    public function test_impor_nilai_mengikuti_rentang_kegiatan_evaluatif(): void
    {
        $this->setUpDasar();
        $this->kegiatanEvaluatif->update(['rentang_nilai' => '0-10']);

        $invalid = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/penilaian/import-potong', [
                'tipe' => 'nilai',
                'tahun_ajaran' => self::TA,
                'semester' => '1',
                'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
                'jenjang' => ['MI'],
                'mode' => 'periksa',
                'total' => 1,
                'terakhir' => true,
                'baris' => [[
                    'nis_lokal' => '99001', 'jenjang' => 'MI', 'kelas' => '6A',
                    'tahun_ajaran' => self::TA, 'semester' => '1', 'Fiqih' => '10.5',
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('galat_baru', 1)
            ->json();

        $this->assertSame('fiqih', $invalid['galat_contoh'][0]['kolom']);
        $this->assertStringContainsString('Santri Manual', $invalid['galat_contoh'][0]['pesan']);
        $this->assertStringContainsString('Fiqih', $invalid['galat_contoh'][0]['pesan']);
        $this->assertStringContainsString('0-10', $invalid['galat_contoh'][0]['pesan']);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/penilaian/import-potong', [
                'tipe' => 'nilai',
                'tahun_ajaran' => self::TA,
                'semester' => '1',
                'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
                'jenjang' => ['MI'],
                'mode' => 'eksekusi',
                'total' => 1,
                'terakhir' => true,
                'baris' => [[
                    'nis_lokal' => '99001', 'jenjang' => 'MI', 'kelas' => '6A',
                    'tahun_ajaran' => self::TA, 'semester' => '1', 'Fiqih' => '10',
                ]],
            ])
            ->assertOk();

        $this->assertDatabaseHas('nilai_santri', [
            'santri_id' => $this->santri->id,
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
            'nilai_akhir' => 10,
            'sumber' => NilaiSantri::IMPOR,
        ]);
    }

    private function simpan(?float $nilai)
    {
        return $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/penilaian/nilai', [
                'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id,
                'semester' => '1',
                'santri_id' => $this->santri->id,
                'mapel_id' => $this->mapel->id,
                'nilai_akhir' => $nilai,
            ]);
    }
}
