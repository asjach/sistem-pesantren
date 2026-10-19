<?php

namespace Tests\Feature;

use App\Models\Dispensasi;
use App\Models\GrupSantriCustom;
use App\Models\JenisTagihan;
use App\Models\Lembaga;
use App\Models\LembagaPegawai;
use App\Models\LembagaSantri;
use App\Models\Pegawai;
use App\Models\PrestasiSantri;
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

    public function test_prestasi_santri_lain_tidak_bisa_dibaca_ditambah_atau_dihapus(): void
    {
        $santri = $this->santri('MTS');
        $data = ['santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'prestasi' => 'Juara'];
        $prestasi = PrestasiSantri::create($data);
        $this->actingAs($this->actor());
        $this->getJson('/api/admin/penilaian/prestasi?tahun_ajaran=2025%2F2026')->assertOk()->assertExactJson([]);
        $this->postJson('/api/admin/penilaian/prestasi', $data)->assertForbidden();
        $this->deleteJson('/api/admin/penilaian/prestasi/'.$prestasi->id)->assertForbidden();
        $this->assertDatabaseHas('prestasi_santri', ['id' => $prestasi->id]);
    }

    public function test_ubah_tagihan_membaca_ulang_saldo_setelah_route_binding(): void
    {
        $santri = $this->santri('MI');
        $jenis = JenisTagihan::create(['nama' => 'Uji saldo', 'tipe' => 'non_bulanan']);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenis_id' => $jenis->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'nominal' => 200]);
        $sekali = true;
        Tagihan::retrieved(function (Tagihan $model) use (&$sekali, $tagihan) {
            if ($sekali && $model->id === $tagihan->id) {
                $sekali = false;
                DB::table('tagihan')->where('id', $tagihan->id)->update(['terbayar' => 150]);
            }
        });
        try {
            $this->actingAs($this->actor())->patchJson('/api/admin/keuangan/tagihan/'.$tagihan->id, ['nominal' => 100, 'tahun_ajaran' => '2025/2026'])->assertUnprocessable();
            $this->assertDatabaseHas('tagihan', ['id' => $tagihan->id, 'nominal' => 200, 'terbayar' => 150]);
        } finally {
            Tagihan::flushEventListeners();
        }
    }

    public function test_master_pegawai_dan_ekspor_tidak_membuka_identitas_lembaga_lain(): void
    {
        $asing = null;
        foreach (['MI', 'MTS'] as $jenjang) {
            $pegawai = Pegawai::create(['nama_lengkap' => 'Pegawai '.$jenjang, 'jenis_kelamin' => 'L']);
            LembagaPegawai::create(['pegawai_id' => $pegawai->id, 'jenjang' => $jenjang]);
            if ($jenjang === 'MTS') {
                $asing = $pegawai;
            }
        }
        $this->actingAs($this->actor());
        $this->getJson('/api/admin/pegawai')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/pegawai/data-existing')->assertOk()->assertJsonCount(1, 'baris');
        $this->patchJson('/api/admin/pegawai/'.$asing->id, ['nama_lengkap' => 'Diubah', 'jenis_kelamin' => 'L'])->assertForbidden();
        $this->deleteJson('/api/admin/pegawai/'.$asing->id)->assertForbidden();
        $this->postJson('/api/admin/pegawai/'.$asing->id.'/tautkan-akun', ['user_id' => null])->assertForbidden();
        $this->postJson('/api/admin/pegawai/import-potong', [
            'mode' => 'eksekusi', 'total' => 1, 'terakhir' => true,
            'baris' => [['pegawai_id' => $asing->id, 'nama_lengkap' => 'Diubah lewat impor']],
        ])->assertOk()->assertJsonPath('ringkasan.baris_gagal', 1);
        $this->assertSame('Pegawai MTS', $asing->fresh()->nama_lengkap);
        $this->getJson('/api/admin/pegawai/'.$asing->id.'/penempatan')->assertForbidden();
        $this->postJson('/api/admin/pegawai/'.$asing->id.'/tempatkan', ['jenjang' => 'MI'])->assertForbidden();
    }

    public function test_grup_custom_dan_anggotanya_mengikuti_scope_lembaga(): void
    {
        $asing = GrupSantriCustom::create(['nama' => 'Grup MTS', 'jenjang' => 'MTS']);
        $milik = GrupSantriCustom::create(['nama' => 'Grup MI', 'jenjang' => 'MI']);
        $anakAsing = $this->santri('MTS');
        $milik->santri()->attach($anakAsing->id); // Data lama yang sudah telanjur campur.
        $this->actingAs($this->actor());
        $this->getJson('/api/admin/keuangan/grup-custom')->assertOk()->assertJsonCount(1)->assertJsonCount(0, '0.santri');
        $this->patchJson('/api/admin/keuangan/grup-custom/'.$asing->id, ['nama' => 'Pindah', 'jenjang' => 'MI'])->assertForbidden();
        $this->deleteJson('/api/admin/keuangan/grup-custom/'.$asing->id)->assertForbidden();
        $this->postJson('/api/admin/keuangan/grup-custom/'.$milik->id.'/anggota', ['santri_ids' => [$anakAsing->id]])->assertForbidden();
        $this->deleteJson('/api/admin/keuangan/grup-custom/'.$asing->id.'/anggota/'.$anakAsing->id)->assertForbidden();
        $this->postJson('/api/admin/keuangan/grup-custom', ['nama' => 'Grup lama tanpa jenjang'])->assertCreated()->assertJsonPath('jenjang', 'MI');
    }
}
