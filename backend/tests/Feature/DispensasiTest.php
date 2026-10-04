<?php

namespace Tests\Feature;

use App\Models\Dispensasi;
use App\Models\JenisTagihan;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DispensasiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2025/2026']);
    }

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    private function santriDenganRiwayat(string $nama, string $tingkat = '1', ?int $kelasId = null, string $jenjang = 'MI'): Santri
    {
        $santri = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        DB::table('riwayat_belajar')->insert([
            'santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => $jenjang,
            'tingkat' => $tingkat, 'kelas_id' => $kelasId, 'semester' => '1',
            'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $santri;
    }

    public function test_crud_dispensasi_guard_hapus_dan_batas_lembaga(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);

        $id = $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Anak Pegawai', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id,
            'paket' => ['MI'], 'tipe' => 'persen', 'nilai' => 50, 'prioritas' => 1,
        ])->assertStatus(201)->json('id');

        $this->actingAs($admin)->getJson('/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026')
            ->assertStatus(200)->assertJsonCount(1)
            ->assertJsonPath('0.nama', 'Anak Pegawai')
            ->assertJsonPath('0.paket', ['MI']);

        // Persen > 100 ditolak.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Salah', 'tahun_ajaran' => '2025/2026', 'tipe' => 'persen', 'nilai' => 150,
        ])->assertStatus(422);

        // Update nonaktif.
        $this->actingAs($admin)->putJson("/api/admin/keuangan/dispensasi/{$id}", [
            'nama' => 'Anak Pegawai', 'tahun_ajaran' => '2025/2026', 'tipe' => 'persen', 'nilai' => 50, 'is_active' => false,
        ])->assertStatus(200);
        $this->assertFalse(Dispensasi::find($id)->is_active);

        // Sudah dipakai tagihan → tidak bisa dihapus (nonaktifkan saja).
        $santri = $this->santriDenganRiwayat('Santri A');
        Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 50000,
            'potongan' => 50000, 'dispensasi_ids' => [$id],
        ]);
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/dispensasi/{$id}")->assertStatus(422);

        // Belum dipakai → boleh hapus.
        $id2 = $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Bebas Uji', 'tahun_ajaran' => '2025/2026', 'tipe' => 'bebas', 'nilai' => 0,
        ])->assertStatus(201)->json('id');
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/dispensasi/{$id2}")->assertStatus(200);

        // Admin lembaga: paket MTS (tak diakses) ditolak; tanpa paket (global) ditolak.
        $adminMi = User::create(['name' => 'Admin MI', 'email' => 'adminmi@example.com', 'phone' => '081234567891', 'password' => 'password']);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert(['user_id' => $adminMi->id, 'jenjang' => 'MI', 'created_at' => now(), 'updated_at' => now()]);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Salah Lembaga', 'tahun_ajaran' => '2025/2026', 'paket' => ['MTS'], 'tipe' => 'nominal', 'nilai' => 1000,
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Global Admin MI', 'tahun_ajaran' => '2025/2026', 'tipe' => 'nominal', 'nilai' => 1000,
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Khusus MI', 'tahun_ajaran' => '2025/2026', 'paket' => ['MI'], 'tipe' => 'nominal', 'nilai' => 1000,
        ])->assertStatus(201);
    }

    public function test_generate_menerapkan_dispensasi_akumulatif_dan_manual_menang(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Dispen', '1');
        $lain = $this->santriDenganRiwayat('Santri Biasa', '2');

        // Akumulatif: persen 50 (prioritas 1) lalu nominal 10.000 (prioritas 2).
        Dispensasi::create(['nama' => 'Setengah', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'paket' => ['MI'], 'tipe' => 'persen', 'nilai' => 50, 'prioritas' => 1]);
        Dispensasi::create(['nama' => 'Potongan', 'tahun_ajaran' => '2025/2026', 'paket' => ['MI'], 'tipe' => 'nominal', 'nilai' => 10000, 'prioritas' => 2]);

        // Default 100.000 → 50% = 50.000 → −10.000 = 40.000 (potongan 60.000).
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id], ['santri_id' => $lain->id, 'nominal' => 20000]],
        ])->assertStatus(200)->assertJson(['dibuat' => 2, 'dilewati' => 0]);

        $otomatis = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame(40000, $otomatis->nominal);
        $this->assertSame(60000, $otomatis->potongan);
        $this->assertCount(2, $otomatis->dispensasi_ids);

        // Manual menang: nominal apa adanya, potongan 0, tanpa jejak dispensasi.
        $manual = Tagihan::where('santri_id', $lain->id)->firstOrFail();
        $this->assertSame(20000, $manual->nominal);
        $this->assertSame(0, $manual->potongan);
        $this->assertNull($manual->dispensasi_ids);
    }

    public function test_dispensasi_bebas_dan_batas_tahun_ajaran(): void
    {
        $admin = $this->admin();
        TahunAjaran::create(['nama' => '2024/2025']);
        $jenis = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Bebas');

        Dispensasi::create(['nama' => 'Bebas Penuh', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'paket' => ['MI'], 'tipe' => 'bebas', 'nilai' => 0]);
        Dispensasi::create(['nama' => 'TA Lain', 'tahun_ajaran' => '2024/2025', 'jenis_id' => $jenis->id, 'paket' => ['MI'], 'tipe' => 'nominal', 'nilai' => 99000]);

        // TA 2025/2026: hanya dispensasi bebas yang berlaku → nominal 0, tagihan tetap dibuat.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 1, 'dilewati' => 0]);
        $tagihan = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame(0, $tagihan->nominal);
        $this->assertSame('2025/2026', $tagihan->periode);
    }

    public function test_dispensasi_paket_mi_mencakup_santri_mi_md(): void
    {
        $admin = $this->admin();
        Lembaga::create(['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true]);
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri MI MD', 'jk' => 'P']);
        DB::table('riwayat_belajar')->insert([
            ['santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'tingkat' => '1', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
            ['santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MD', 'tingkat' => '1', 'semester' => '1', 'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
        ]);
        Dispensasi::create(['nama' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'paket' => ['MI'], 'tipe' => 'nominal', 'nilai' => 5000]);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
            'nominal' => 100000, 'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200)->assertJson(['dibuat' => 1, 'dilewati' => 0]);

        $tagihan = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        $this->assertSame(95000, $tagihan->nominal);
        $this->assertSame(5000, $tagihan->potongan);
        $this->assertSame('MI-MD', $tagihan->paket);
    }

    public function test_index_dispensasi_per_santri_dan_kelas(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $kelas = Kelas::create(['jenjang' => 'MI', 'tahun_ajaran' => '2025/2026', 'tingkat' => '1', 'nama_kelas' => 'I-A']);
        $santri = $this->santriDenganRiwayat('Santri Kelas', '1', $kelas->id);
        $lain = $this->santriDenganRiwayat('Santri Lain', '2');

        Dispensasi::create(['nama' => 'Kelas I-A', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'kelas_id' => [$kelas->id], 'tipe' => 'nominal', 'nilai' => 5000]);
        Dispensasi::create(['nama' => 'Kelas Lain', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'kelas_id' => [999], 'tipe' => 'nominal', 'nilai' => 5000]);

        $this->actingAs($admin)->getJson("/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026&santri_id={$santri->id}")
            ->assertStatus(200)->assertJsonCount(1)->assertJsonPath('0.nama', 'Kelas I-A');
        $this->actingAs($admin)->getJson("/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026&santri_id={$lain->id}")
            ->assertStatus(200)->assertJsonCount(0);
    }
}
