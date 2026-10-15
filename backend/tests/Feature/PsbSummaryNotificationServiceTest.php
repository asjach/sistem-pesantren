<?php

namespace Tests\Feature;

use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\PsbCalonSantri;
use App\Models\Santri;
use App\Models\User;
use App\Services\PsbSummaryNotificationService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * `PsbSummaryNotificationService` — hitungan antrean per admin WAJIB terbatas
 * lingkup lembaganya. Kebocoran tenant di sini berarti admin MI melihat
 * angka antrean milik MD (data lembaga lain) — inilah yang dikunci.
 */
class PsbSummaryNotificationServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        Lembaga::create(['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true]);
    }

    /** Admin scoped ke jenjang tertentu (bukan admin full/super). */
    private function admin(array $jenjangs, string $role = 'admin'): User
    {
        $u = User::create([
            'name' => ucfirst($role).' '.uniqid(), 'email' => 'psbnotif_'.uniqid().'@example.com',
            'phone' => '08'.random_int(1000000000, 9999999999), 'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($jenjangs as $j) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $j, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    private function calon(string $jenjang, string $status): void
    {
        PsbCalonSantri::create([
            'no_pendaftaran' => 'PSB-'.uniqid(), 'nik' => '320410460905'.random_int(1000, 9999),
            'nama_lengkap' => 'Calon '.uniqid(), 'jenis_kelamin' => 'L',
            'jenjang' => $jenjang, 'status_pendaftaran' => $status,
        ]);
    }

    private function pengajuan(string $jenjang, string $status): void
    {
        $s = Santri::create(['nama_lengkap' => 'Santri '.uniqid(), 'jk' => 'L']);
        // Lembaga santri = keanggotaan (sumber kebenaran), bukan kolom santri.
        LembagaSantri::create([
            'santri_id' => $s->id, 'jenjang' => $jenjang,
            'is_active_lembaga' => 'Ya',
        ]);
        // Pengajuan biodata selalu milik seorang wali (FK wajib) + perubahan_json.
        $wali = User::create([
            'name' => 'Wali '.uniqid(), 'email' => 'wali_'.uniqid().'@example.com',
            'phone' => '08'.random_int(1000000000, 9999999999), 'password' => 'password',
        ]);
        DB::table('pengajuan_biodata_santri')->insert([
            'santri_id' => $s->id, 'wali_user_id' => $wali->id,
            'perubahan_json' => json_encode(['nama_lengkap' => ['lama' => 'A', 'baru' => 'B']]),
            'status' => $status, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_biodata_hanya_menghitung_lembaga_pegang_admin(): void
    {
        $this->pengajuan('MI', 'diajukan');
        $this->pengajuan('MI', 'diajukan');
        $this->pengajuan('MD', 'diajukan');
        $this->pengajuan('MI', 'disetujui'); // bukan "diajukan"

        $svc = new PsbSummaryNotificationService;

        // Admin MI: 2, bukan 3 (MD tidak boleh terhitung).
        $this->assertSame(2, $svc->refreshBiodata($this->admin(['MI'])));
        // Admin MD: 1.
        $this->assertSame(1, $svc->refreshBiodata($this->admin(['MD'])));
    }

    public function test_daftar_ulang_hanya_menghitung_lembaga_pegang_admin(): void
    {
        $this->calon('MI', 'ajukan_daftar_ulang');
        $this->calon('MD', 'ajukan_daftar_ulang');
        $this->calon('MD', 'ajukan_daftar_ulang');
        $this->calon('MI', 'terima'); // bukan ajukan_daftar_ulang

        $svc = new PsbSummaryNotificationService;

        $this->assertSame(1, $svc->refreshDaftarUlang($this->admin(['MI'])));
        $this->assertSame(2, $svc->refreshDaftarUlang($this->admin(['MD'])));
    }

    /** Admin full (bolehPesantren) melihat SEMUA lembaga — bukan kebocoran. */
    public function test_admin_full_menghitung_semua_lembaga(): void
    {
        $this->calon('MI', 'ajukan_daftar_ulang');
        $this->calon('MD', 'ajukan_daftar_ulang');

        $svc = new PsbSummaryNotificationService;

        $this->assertSame(2, $svc->refreshDaftarUlang($this->admin([], 'super_admin')));
    }

    /**
     * Regresi: admin SCOPED pernah meledak 'no such column: s.jenjang' karena
     * saringan tenant mengira `santri` punya kolom `jenjang`. Kini lewat
     * keanggotaan — terbukti tidak error dan angkanya benar.
     */
    public function test_admin_scoped_tidak_meledak_dan_angkanya_benar(): void
    {
        $this->pengajuan('MI', 'diajukan');
        $this->pengajuan('MD', 'diajukan');

        $svc = new PsbSummaryNotificationService;

        $this->assertSame(1, $svc->refreshBiodata($this->admin(['MI'])));
    }

    /**
     * Santri tanpa keanggotaan = arsip pusat/pra-penerimaan → tetap terlihat
     * admin scoped (mengikuti aturan PengajuanBiodataController), bukan
     * hilang dari hitungan.
     */
    public function test_santri_tanpa_keanggotaan_ikut_terhitung_admin_scoped(): void
    {
        // Pengajuan tanpa baris lembaga_santri sama sekali.
        $s = Santri::create(['nama_lengkap' => 'Arsip Pusat '.uniqid(), 'jk' => 'L']);
        $wali = User::create([
            'name' => 'Wali '.uniqid(), 'email' => 'wali_'.uniqid().'@example.com',
            'phone' => '08'.random_int(1000000000, 9999999999), 'password' => 'password',
        ]);
        DB::table('pengajuan_biodata_santri')->insert([
            'santri_id' => $s->id, 'wali_user_id' => $wali->id,
            'perubahan_json' => json_encode(['nama_lengkap' => ['lama' => 'A', 'baru' => 'B']]),
            'status' => 'diajukan', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $svc = new PsbSummaryNotificationService;

        $this->assertSame(1, $svc->refreshBiodata($this->admin(['MI'])));
    }
}
