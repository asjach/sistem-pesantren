<?php

namespace Tests\Feature;

use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\KegiatanEvaluatif;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PesertaKegiatanEvaluatifTest extends TestCase
{
    use RefreshDatabase;

    private const TA = '2026/2027';

    private User $admin;

    private KegiatanEvaluatif $kegiatanEvaluatif;

    /** @var array<string, Santri> */
    private array $santri = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'is_seleksi' => false,
            'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        TahunAjaran::create(['nama' => self::TA, 'is_aktif' => true]);
        foreach (range(1, 6) as $urutan => $tingkat) {
            DB::table('ref_tingkat')->insert([
                'jenjang' => 'MI', 'nama' => (string) $tingkat,
                'urutan' => $urutan, 'is_active' => true,
            ]);
        }

        $kelasSatu = $this->kelas('1A', '1');
        $kelasDua = $this->kelas('2A', '2');
        $this->santri['satu_a'] = $this->santriDiKelas('Ahmad', '26001', $kelasSatu, '1', 1);
        $this->santri['satu_b'] = $this->santriDiKelas('Badrun', '26002', $kelasSatu, '1', 2);
        $this->santri['dua_a'] = $this->santriDiKelas('Candra', '26003', $kelasDua, '2', 1);

        $this->kegiatanEvaluatif = KegiatanEvaluatif::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA, 'kode' => 'ASAS',
            'nama' => 'Asesmen Sumatif Akhir Semester',
            'cakupan' => KegiatanEvaluatif::CAKUPAN_SEMUA,
            'kurikulum' => 'keduanya', 'jenis_rapor' => KegiatanEvaluatif::RAPOR_AKHIR,
            'urutan' => 1, 'is_active' => true,
        ]);

        $this->admin = User::create([
            'name' => 'Admin Peserta', 'email' => 'admin-peserta@example.com',
            'phone' => '081234567890', 'password' => 'password',
        ]);
        $this->admin->assignRole('super_admin');
    }

    public function test_daftar_memuat_peserta_dan_pengaturan_bawaan(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/penilaian/peserta-kartu?kegiatan_evaluatif_id='.$this->kegiatanEvaluatif->id.'&semester=1')
            ->assertOk()
            ->assertJsonPath('ringkasan.total', 3)
            ->assertJsonPath('ringkasan.belum_bernomor', 3)
            ->assertJsonPath('pengaturan.mode_urutan', 'per_tingkat')
            ->assertJsonPath('pengaturan.template', '{ta_awal_2}.{ta_akhir_2}.{kode_kegiatan_evaluatif}.{tingkat_2}.{nomor_4}')
            ->assertJsonCount(9, 'token');
    }

    public function test_generate_reset_per_tingkat_melindungi_nomor_manual(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/penilaian/peserta-kartu/'.$this->santri['satu_a']->id, [
                'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id, 'semester' => '1',
                'nomor_peserta' => 'MANUAL-001',
            ])->assertOk();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/penilaian/peserta-kartu/generate', [
                'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id, 'semester' => '1',
                'template' => '{ta_awal_2}.{ta_akhir_2}.{kode_kegiatan_evaluatif}.{tingkat_2}.{nomor_4}',
                'mode_urutan' => 'per_tingkat',
            ])
            ->assertOk()
            ->assertJsonPath('hasil.dibuat', 2)
            ->assertJsonPath('hasil.dipertahankan_manual', 1);

        $this->assertDatabaseHas('peserta_kegiatan_evaluatif', [
            'santri_id' => $this->santri['satu_a']->id, 'nomor_peserta' => 'MANUAL-001',
            'sumber_nomor' => 'manual',
        ]);
        $this->assertDatabaseHas('peserta_kegiatan_evaluatif', [
            'santri_id' => $this->santri['satu_b']->id, 'nomor_peserta' => '26.27.ASAS.01.0002',
            'sumber_nomor' => 'otomatis',
        ]);
        $this->assertDatabaseHas('peserta_kegiatan_evaluatif', [
            'santri_id' => $this->santri['dua_a']->id, 'nomor_peserta' => '26.27.ASAS.02.0001',
            'sumber_nomor' => 'otomatis',
        ]);
    }

    public function test_generate_berurutan_semua_tingkat_dan_buat_ulang_bersifat_eksplisit(): void
    {
        $payload = [
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id, 'semester' => '1',
            'template' => 'ASAS-{nomor_3}', 'mode_urutan' => 'semua_tingkat',
        ];

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/penilaian/peserta-kartu/generate', $payload)
            ->assertOk()->assertJsonPath('hasil.dibuat', 3);
        $this->assertDatabaseHas('peserta_kegiatan_evaluatif', [
            'santri_id' => $this->santri['dua_a']->id, 'nomor_peserta' => 'ASAS-003',
        ]);

        $payload['template'] = 'BARU-{nomor_3}';
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/penilaian/peserta-kartu/generate', $payload)
            ->assertOk()
            ->assertJsonPath('hasil.dibuat', 0)
            ->assertJsonPath('hasil.dipertahankan_otomatis', 3);
        $this->assertDatabaseHas('peserta_kegiatan_evaluatif', [
            'santri_id' => $this->santri['dua_a']->id, 'nomor_peserta' => 'ASAS-003',
        ]);

        $payload['buat_ulang_otomatis'] = true;
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/penilaian/peserta-kartu/generate', $payload)
            ->assertOk()->assertJsonPath('hasil.dibuat', 3);
        $this->assertDatabaseHas('peserta_kegiatan_evaluatif', [
            'santri_id' => $this->santri['dua_a']->id, 'nomor_peserta' => 'BARU-003',
        ]);
    }

    public function test_nomor_manual_harus_unik_dan_boleh_dikosongkan(): void
    {
        $urlSatu = '/api/admin/penilaian/peserta-kartu/'.$this->santri['satu_a']->id;
        $urlDua = '/api/admin/penilaian/peserta-kartu/'.$this->santri['satu_b']->id;
        $payload = [
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id, 'semester' => '1',
            'nomor_peserta' => 'SAMA-001',
        ];

        $this->actingAs($this->admin, 'sanctum')->putJson($urlSatu, $payload)->assertOk();
        $this->actingAs($this->admin, 'sanctum')
            ->putJson($urlDua, $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('nomor_peserta');

        $payload['nomor_peserta'] = null;
        $this->actingAs($this->admin, 'sanctum')->putJson($urlSatu, $payload)->assertOk();
        $this->assertDatabaseMissing('peserta_kegiatan_evaluatif', [
            'santri_id' => $this->santri['satu_a']->id,
            'kegiatan_evaluatif_id' => $this->kegiatanEvaluatif->id, 'semester' => '1',
        ]);
    }

    private function kelas(string $nama, string $tingkat): Kelas
    {
        return Kelas::create([
            'jenjang' => 'MI', 'tahun_ajaran' => self::TA,
            'nama_kelas' => $nama, 'tingkat' => $tingkat,
        ]);
    }

    private function santriDiKelas(string $nama, string $nis, Kelas $kelas, string $tingkat, int $absen): Santri
    {
        $santri = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        LembagaSantri::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI',
            'nis_lokal' => $nis, 'is_active_lembaga' => 'Ya',
        ]);
        RiwayatBelajar::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => self::TA,
            'semester' => '1', 'kelas_id' => $kelas->id, 'tingkat' => $tingkat,
            'no_absen' => $absen, 'status_awal' => 'santri_baru',
            'status_akhir' => 'aktif', 'is_active_riwayat' => RiwayatBelajar::YA,
        ]);

        return $santri;
    }
}
