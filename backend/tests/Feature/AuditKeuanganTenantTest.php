<?php

namespace Tests\Feature;

use App\Models\JenisTagihan;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\TarifTagihan;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuditKeuanganTenantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        foreach (['MI', 'MD', 'MTS'] as $jenjang) {
            Lembaga::create(['jenjang' => $jenjang, 'nama' => $jenjang, 'is_active' => true]);
        }
        TahunAjaran::create(['nama' => '2025/2026']);
    }

    private function actor(string $role = 'admin', array $lembaga = ['MI']): User
    {
        $user = User::create(['name' => 'Audit', 'email' => uniqid().'@example.com', 'password' => 'password']);
        $user->assignRole($role);
        foreach ($lembaga as $jenjang) {
            DB::table('user_lembaga')->insert(['user_id' => $user->id, 'jenjang' => $jenjang]);
        }

        return $user;
    }

    private function santri(string $jenjang): Santri
    {
        $santri = Santri::create(['nama_lengkap' => 'Santri '.$jenjang, 'jk' => 'L']);
        LembagaSantri::create(['santri_id' => $santri->id, 'jenjang' => $jenjang, 'is_active_lembaga' => 'Ya']);
        RiwayatBelajar::create(['santri_id' => $santri->id, 'jenjang' => $jenjang, 'tahun_ajaran' => '2025/2026', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya']);

        return $santri;
    }

    public function test_daftar_dan_roster_keuangan_tetap_dibatasi_tanpa_filter(): void
    {
        $ids = [];
        foreach (['MI', 'MD', 'MTS'] as $jenjang) {
            $santri = $this->santri($jenjang);
            $ids[$jenjang] = $santri->id;
            $jenis = JenisTagihan::create(['nama' => $jenjang, 'tipe' => 'non_bulanan', 'jenjang' => $jenjang]);
            TarifTagihan::create(['jenis_id' => $jenis->id, 'jenjang' => $jenjang, 'tahun_ajaran' => '2025/2026', 'nominal' => 100]);
            Tagihan::create(['santri_id' => $santri->id, 'jenis_id' => $jenis->id, 'jenjang' => $jenjang, 'tahun_ajaran' => '2025/2026', 'nominal' => 100]);
        }
        $this->santri('MTS');
        $this->actingAs($this->actor());
        $this->getJson('/api/admin/keuangan/tagihan')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/keuangan/tarif')->assertOk()->assertJsonCount(2);
        $crosstab = $this->getJson('/api/admin/keuangan/tagihan/crosstab?tahun_ajaran[]=2025%2F2026')
            ->assertOk()->assertJsonPath('total', 2)->json();
        $this->assertEqualsCanonicalizing([$ids['MI'], $ids['MD']], array_column($crosstab['baris'], 'santri_id'));
        foreach (['tagihan', 'tarif', 'tagihan/crosstab'] as $path) {
            $this->getJson('/api/admin/keuangan/'.$path.'?jenjang[]=MTS')->assertForbidden();
        }
        $this->actingAs($this->actor('super_admin', []));
        $this->withHeader('X-Lembaga-Aktif', 'MTS')->getJson('/api/admin/keuangan/tagihan')->assertOk()->assertJsonCount(1, 'data');
    }
}
