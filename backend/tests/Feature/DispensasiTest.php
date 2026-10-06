<?php

namespace Tests\Feature;

use App\Models\Dispensasi;
use App\Models\JenisTagihan;
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
        DB::table('lembaga')->insert(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        TahunAjaran::create(['nama' => '2025/2026']);
    }

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    private function santriDenganRiwayat(string $nama, string $jenjang = 'MI'): Santri
    {
        $santri = Santri::create(['nama_lengkap' => $nama, 'jk' => 'L']);
        DB::table('riwayat_belajar')->insert([
            'santri_id' => $santri->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => $jenjang,
            'tingkat' => '1', 'kelas_id' => null, 'semester' => '1',
            'status_akhir' => 'aktif', 'is_active_riwayat' => 'Ya',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $santri;
    }

    public function test_crud_paket_multi_aturan_dan_guard_hapus(): void
    {
        $admin = $this->admin();
        $asas = JenisTagihan::create(['nama' => 'ASAS', 'tipe' => 'non_bulanan']);
        $hipa = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = $this->santriDenganRiwayat('Santri A');

        $id = $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Anak Pegawai', 'tahun_ajaran' => '2025/2026',
            'aturan' => [
                ['jenis_id' => $asas->id, 'tipe' => 'persen', 'nilai' => 50],
                ['jenis_id' => $hipa->id, 'tipe' => 'nominal', 'nilai' => 50000],
            ],
            'santri_ids' => [$santri->id],
        ])->assertStatus(201)
            ->assertJsonPath('nama', 'Anak Pegawai')
            ->assertJsonPath('santri_ids', [$santri->id])
            ->json('id');

        $this->assertDatabaseCount('dispensasi_aturan', 2);
        $this->assertDatabaseHas('santri_dispensasi', ['dispensasi_id' => $id, 'santri_id' => $santri->id]);

        // Daftar memuat aturan + santri.
        $this->actingAs($admin)->getJson('/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026')
            ->assertStatus(200)->assertJsonCount(1)
            ->assertJsonPath('0.aturan.0.jenis_id', $asas->id)
            ->assertJsonPath('0.aturan.0.tipe', 'persen');

        // Persen > 100 ditolak; campur semua-jenis + spesifik ditolak.
        $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Salah', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $asas->id, 'tipe' => 'persen', 'nilai' => 150]],
        ])->assertStatus(422);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Salah', 'tahun_ajaran' => '2025/2026',
            'aturan' => [
                ['jenis_id' => null, 'tipe' => 'bebas', 'nilai' => 0],
                ['jenis_id' => $asas->id, 'tipe' => 'persen', 'nilai' => 10],
            ],
        ])->assertStatus(422);

        // Update mengganti aturan + mengosongkan santri (sync).
        $this->actingAs($admin)->putJson("/api/admin/keuangan/dispensasi/{$id}", [
            'nama' => 'Anak Pegawai', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $asas->id, 'tipe' => 'bebas', 'nilai' => 0]],
        ])->assertStatus(200)->assertJsonPath('santri_ids', null);
        $this->assertDatabaseCount('dispensasi_aturan', 1);
        $this->assertDatabaseMissing('santri_dispensasi', ['dispensasi_id' => $id]);

        // Sudah dipakai tagihan → tidak bisa dihapus (nonaktifkan saja).
        Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $asas->id, 'periode' => '2025/2026', 'nominal' => 0,
            'potongan' => 50000, 'dispensasi_ids' => [$id],
        ]);
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/dispensasi/{$id}")->assertStatus(422);

        // Belum dipakai → boleh hapus, aturan ikut terhapus (cascade).
        $id2 = $this->actingAs($admin)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Bebas Uji', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $hipa->id, 'tipe' => 'bebas', 'nilai' => 0]],
        ])->assertStatus(201)->json('id');
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/dispensasi/{$id2}")->assertStatus(200);
        $this->assertDatabaseMissing('dispensasi_aturan', ['dispensasi_id' => $id2]);
    }

    public function test_batas_lembaga_mengikuti_jenjang_jenis(): void
    {
        $adminMi = User::create(['name' => 'Admin MI', 'email' => 'adminmi@example.com', 'phone' => '081234567891', 'password' => 'password']);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert(['user_id' => $adminMi->id, 'jenjang' => 'MI', 'created_at' => now(), 'updated_at' => now()]);

        $jenisMi = JenisTagihan::create(['nama' => 'Infaq MI', 'tipe' => 'bulanan', 'jenjang' => 'MI']);
        $jenisMts = JenisTagihan::create(['nama' => 'Infaq MTS', 'tipe' => 'bulanan', 'jenjang' => 'MTS']);
        $jenisGlobal = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);

        // Jenis MI boleh; jenis MTS/global/semua-jenis ditolak untuk admin MI.
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Khusus MI', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $jenisMi->id, 'tipe' => 'nominal', 'nilai' => 1000]],
        ])->assertStatus(201);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Salah Lembaga', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $jenisMts->id, 'tipe' => 'nominal', 'nilai' => 1000]],
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Global', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => $jenisGlobal->id, 'tipe' => 'nominal', 'nilai' => 1000]],
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/dispensasi', [
            'nama' => 'Semua Jenis', 'tahun_ajaran' => '2025/2026',
            'aturan' => [['jenis_id' => null, 'tipe' => 'nominal', 'nilai' => 1000]],
        ])->assertStatus(403);
    }

    public function test_generate_menerapkan_multi_aturan_akumulatif_dan_manual_menang(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Dispen');
        $lain = $this->santriDenganRiwayat('Santri Biasa');

        // Dua paket untuk santri yang sama: persen 50 (id kecil dulu) lalu nominal 10.000.
        $d1 = Dispensasi::create(['nama' => 'Setengah', 'tahun_ajaran' => '2025/2026']);
        $d1->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => 'persen', 'nilai' => 50]);
        $d1->santriTambahan()->sync([$santri->id, $lain->id]);
        $d2 = Dispensasi::create(['nama' => 'Potongan', 'tahun_ajaran' => '2025/2026']);
        $d2->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => 'nominal', 'nilai' => 10000]);
        $d2->santriTambahan()->sync([$santri->id]);

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

    public function test_aturan_hanya_berlaku_untuk_jenisnya_dan_bebas_menihilkan(): void
    {
        $admin = $this->admin();
        $asas = JenisTagihan::create(['nama' => 'ASAS', 'tipe' => 'non_bulanan']);
        $hipa = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Bebas');

        $d = Dispensasi::create(['nama' => 'Campur', 'tahun_ajaran' => '2025/2026']);
        $d->aturan()->create(['jenis_id' => $asas->id, 'tipe' => 'persen', 'nilai' => 50]);
        $d->aturan()->create(['jenis_id' => $hipa->id, 'tipe' => 'bebas', 'nilai' => 0]);
        $d->santriTambahan()->sync([$santri->id]);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $asas->id, 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $hipa->id, 'nominal' => 100000,
            'santri' => [['santri_id' => $santri->id]],
        ])->assertStatus(200);

        // ASAS: 50% → 50.000. HIPA: bebas → tagihan tetap dibuat bernominal 0.
        $this->assertSame(50000, Tagihan::where('santri_id', $santri->id)->where('jenis_id', $asas->id)->firstOrFail()->nominal);
        $tagihanHipa = Tagihan::where('santri_id', $santri->id)->where('jenis_id', $hipa->id)->firstOrFail();
        $this->assertSame(0, $tagihanHipa->nominal);
        $this->assertSame('2025/2026', $tagihanHipa->periode);

        // Aturan semua-jenis berlaku ke jenis mana pun.
        $d2 = Dispensasi::create(['nama' => 'Semua', 'tahun_ajaran' => '2025/2026']);
        $d2->aturan()->create(['jenis_id' => null, 'tipe' => 'nominal', 'nilai' => 5000]);
        $lain = $this->santriDenganRiwayat('Santri Semua');
        $d2->santriTambahan()->sync([$lain->id]);
        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'tahun_ajaran' => '2025/2026', 'jenis_id' => $asas->id, 'nominal' => 100000,
            'santri' => [['santri_id' => $lain->id]],
        ])->assertStatus(200);
        $this->assertSame(95000, Tagihan::where('santri_id', $lain->id)->firstOrFail()->nominal);
    }

    public function test_index_hanya_menampilkan_penerima_santri(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $santri = $this->santriDenganRiwayat('Santri Kelas');
        $lain = $this->santriDenganRiwayat('Santri Lain');

        $d = Dispensasi::create(['nama' => 'Khusus', 'tahun_ajaran' => '2025/2026']);
        $d->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => 'nominal', 'nilai' => 5000]);
        $d->santriTambahan()->sync([$santri->id]);

        $this->actingAs($admin)->getJson("/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026&santri_id={$santri->id}")
            ->assertStatus(200)->assertJsonCount(1)->assertJsonPath('0.nama', 'Khusus');
        $this->actingAs($admin)->getJson("/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026&santri_id={$lain->id}")
            ->assertStatus(200)->assertJsonCount(0);

        // Filter jenis: hanya dispensasi yang aturannya mencakup jenis itu.
        $this->actingAs($admin)->getJson("/api/admin/keuangan/dispensasi?tahun_ajaran=2025/2026&jenis_id={$jenis->id}")
            ->assertStatus(200)->assertJsonCount(1);
    }
}
