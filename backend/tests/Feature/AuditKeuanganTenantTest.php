<?php

namespace Tests\Feature;

use App\Models\Dispensasi;
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

    public function test_mutasi_master_memeriksa_pemilik_lama_sebelum_payload_baru(): void
    {
        $jenis = JenisTagihan::create(['nama' => 'Jenis MTS', 'tipe' => 'non_bulanan', 'jenjang' => 'MTS']);
        $paket = Dispensasi::create(['nama' => 'Paket MTS', 'jenjang' => 'MTS', 'tahun_ajaran' => '2025/2026']);
        $paket->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => 'nominal', 'nilai' => 10]);
        $this->actingAs($this->actor());
        $this->patchJson('/api/admin/keuangan/jenis/'.$jenis->id, ['nama' => 'Pindah', 'jenjang' => 'MI'])->assertForbidden();
        $this->deleteJson('/api/admin/keuangan/dispensasi/'.$paket->id)->assertForbidden();
        $this->assertDatabaseHas('jenis_tagihan', ['id' => $jenis->id, 'jenjang' => 'MTS']);
        $this->assertDatabaseHas('dispensasi', ['id' => $paket->id]);
    }

    public function test_tagihan_menolak_santri_dan_jenis_dari_lembaga_lain(): void
    {
        $santri = $this->santri('MTS');
        $mi = $this->santri('MI');
        $jenis = JenisTagihan::create(['nama' => 'MTS', 'tipe' => 'non_bulanan', 'jenjang' => 'MTS']);
        $global = JenisTagihan::create(['nama' => 'Global', 'tipe' => 'non_bulanan']);
        $this->actingAs($this->actor());
        $payload = ['tahun_ajaran' => '2025/2026', 'nominal' => 100, 'jenjang' => 'MI'];
        $this->postJson('/api/admin/keuangan/tagihan', $payload + ['santri_id' => $santri->id, 'jenis_id' => $global->id])->assertUnprocessable();
        $this->postJson('/api/admin/keuangan/tagihan', $payload + ['santri_id' => $mi->id, 'jenis_id' => $jenis->id])->assertForbidden();
        foreach (['generate', 'pratinjau'] as $aksi) {
            $this->postJson('/api/admin/keuangan/tagihan/'.$aksi, ['jenis_id' => $jenis->id, 'tahun_ajaran' => '2025/2026', 'nominal' => 100, 'santri' => [['santri_id' => $mi->id]]])->assertForbidden();
        }
        $this->assertDatabaseCount('tagihan', 0);
        $this->postJson('/api/admin/keuangan/tagihan', $payload + ['santri_id' => $mi->id, 'jenis_id' => $global->id])->assertCreated();
    }
}
