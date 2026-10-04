<?php

namespace Tests\Feature;

use App\Models\JenisTagihan;
use App\Models\Lembaga;
use App\Models\Pembayaran;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\TarifTagihan;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class KeuanganTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Lembaga::create(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        Lembaga::create(['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true]);
        TahunAjaran::create(['nama' => '2025/2026']);
    }

    protected function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    public function test_generate_tagihan_per_paket(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);

        $miOnly = Santri::create(['nama_lengkap' => 'Santri MI', 'jk' => 'L']);
        $mimd = Santri::create(['nama_lengkap' => 'Santri MIMD', 'jk' => 'P']);
        DB::table('riwayat_belajar')->insert([
            ['santri_id' => $miOnly->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'semester' => '1', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
            ['santri_id' => $mimd->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MI', 'semester' => '1', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
            ['santri_id' => $mimd->id, 'tahun_ajaran' => '2025/2026', 'jenjang' => 'MD', 'semester' => '1', 'is_active_riwayat' => 'Ya', 'created_at' => now(), 'updated_at' => now()],
        ]);

        TarifTagihan::create(['jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 75000]);
        TarifTagihan::create(['jenjang' => 'MI', 'paket' => 'MI-MD', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 75000]);

        $res = $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
        ])->assertStatus(200);
        $this->assertDatabaseCount('tagihan', 1);
        $this->assertSame('2025-07', Tagihan::first()->periode);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/tagihan/generate', [
            'jenjang' => 'MI', 'paket' => 'MI-MD', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-07',
        ])->assertStatus(200);
        $this->assertDatabaseCount('tagihan', 2);
    }

    public function test_jenis_tagihan_scoping_lembaga(): void
    {
        $pusat = $this->admin();
        Lembaga::create(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true]);
        $adminMi = User::create(['name' => 'Admin MI', 'email' => 'adminmi@example.com', 'phone' => '081234567891', 'password' => 'password']);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert(['user_id' => $adminMi->id, 'jenjang' => 'MI', 'created_at' => now(), 'updated_at' => now()]);

        $global = $this->actingAs($pusat)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Infaq Bulanan', 'tipe' => 'bulanan',
        ])->assertStatus(201)->json('id');
        $this->actingAs($pusat)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Kas MI', 'tipe' => 'non_bulanan', 'jenjang' => 'MI',
        ])->assertStatus(201);

        // Filter lembaga: global selalu ikut.
        $this->actingAs($pusat)->getJson('/api/admin/keuangan/jenis?jenjang=MI')
            ->assertStatus(200)->assertJsonCount(2);
        $this->actingAs($pusat)->getJson('/api/admin/keuangan/jenis?jenjang=MTS')
            ->assertStatus(200)->assertJsonCount(1);

        // Admin lembaga: tak boleh membuat jenis global, boleh khusus lembaganya.
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Pungutan Umum', 'tipe' => 'non_bulanan',
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Pungutan Umum', 'tipe' => 'non_bulanan', 'jenjang' => 'MTS',
        ])->assertStatus(403);
        $this->actingAs($adminMi)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Pungutan Umum', 'tipe' => 'non_bulanan', 'jenjang' => 'MI',
        ])->assertStatus(201);

        // Tanpa filter: admin hanya melihat global + miliknya.
        $this->actingAs($adminMi)->getJson('/api/admin/keuangan/jenis')
            ->assertStatus(200)->assertJsonCount(3);

        // Ubah cakupan ke global ditolak untuk admin lembaga.
        $this->actingAs($adminMi)->putJson("/api/admin/keuangan/jenis/{$global}", [
            'nama' => 'Infaq Bulanan', 'tipe' => 'bulanan',
        ])->assertStatus(403);
    }

    public function test_jenis_tagihan_act_as_tidak_bisa_ubah_global(): void
    {
        $pusat = $this->admin();
        $global = JenisTagihan::create(['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan']);
        $milikMi = JenisTagihan::create(['nama' => 'Kas MI', 'tipe' => 'non_bulanan', 'jenjang' => 'MI']);
        $hdr = ['X-Lembaga-Aktif' => 'MI'];

        // Bertindak sebagai MI: buat/ubah jenis global ditolak.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->postJson('/api/admin/keuangan/jenis', [
            'nama' => 'Pungutan Global', 'tipe' => 'non_bulanan',
        ])->assertStatus(403);
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->putJson("/api/admin/keuangan/jenis/{$global->id}", [
            'nama' => 'Infaq Bulanan', 'tipe' => 'bulanan', 'is_active' => false,
        ])->assertStatus(403);
        $this->assertTrue($global->fresh()->is_active);

        // Jenis milik lembaga yang diperankan tetap boleh diubah.
        $this->actingAs($pusat, 'sanctum')->withHeaders($hdr)->putJson("/api/admin/keuangan/jenis/{$milikMi->id}", [
            'nama' => 'Kas MI', 'tipe' => 'non_bulanan', 'is_active' => false,
        ])->assertStatus(200);
        $this->assertFalse($milikMi->fresh()->is_active);

        // Kembali penuh (tanpa header): jenis global boleh diubah.
        $this->flushHeaders();
        $this->actingAs($pusat, 'sanctum')->putJson("/api/admin/keuangan/jenis/{$global->id}", [
            'nama' => 'Infaq Bulanan', 'tipe' => 'bulanan', 'is_active' => false,
        ])->assertStatus(200);
        $this->assertFalse($global->fresh()->is_active);
    }

    public function test_hapus_tagihan(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Hapus', 'jk' => 'L']);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 100000]);

        // Hapus tagihan tanpa pembayaran.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tagihan/{$tagihan->id}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('tagihan', ['id' => $tagihan->id]);

        // Tagihan ber-pembayaran aktif tak bisa dihapus langsung.
        $tagihan2 = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'periode' => '2025-01', 'nominal' => 100000]);
        $bayar = $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan2->id, 'jumlah' => 20000,
        ])->assertStatus(201)->json('id');
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tagihan/{$tagihan2->id}")
            ->assertStatus(422);

        // Batalkan dulu pembayarannya, baru tagihan bisa dihapus permanen.
        $this->actingAs($admin)->postJson("/api/admin/keuangan/pembayaran/{$bayar}/batal")
            ->assertStatus(200);
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/tagihan/{$tagihan2->id}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('tagihan', ['id' => $tagihan2->id]);
        $this->assertDatabaseMissing('pembayaran', ['id' => $bayar]);
    }

    public function test_pembayaran_dan_sisa(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'Ujian', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Ujian', 'jk' => 'L']);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 800000]);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan->id, 'jumlah' => 300000, 'metode' => 'tunai', 'kas' => 'tunai_tu',
        ])->assertStatus(201)->assertJsonStructure(['no_kwitansi']);
        $tagihan->refresh();
        $this->assertSame('sebagian', $tagihan->status);
        $this->assertSame(300000, $tagihan->terbayar);

        $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan->id, 'jumlah' => 500000, 'metode' => 'transfer', 'kas' => 'bank_lembaga',
        ])->assertStatus(201);
        $tagihan->refresh();
        $this->assertSame('lunas', $tagihan->status);
        $this->assertSame(800000, $tagihan->terbayar);

        $p = Pembayaran::where('tagihan_id', $tagihan->id)->first();
        $this->actingAs($admin)->postJson("/api/admin/keuangan/pembayaran/{$p->id}/batal")->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(500000, $tagihan->terbayar);
        $this->assertSame('sebagian', $tagihan->status);

        $tunggakan = $this->actingAs($admin)->getJson('/api/admin/keuangan/tunggakan')->assertStatus(200)->json('per_santri');
        $this->assertNotEmpty($tunggakan);
    }

    public function test_hapus_pembayaran(): void
    {
        $admin = $this->admin();
        $jenis = JenisTagihan::create(['nama' => 'HIPA', 'tipe' => 'non_bulanan']);
        $santri = Santri::create(['nama_lengkap' => 'Santri Hapus Bayar', 'jk' => 'L']);
        $tagihan = Tagihan::create(['santri_id' => $santri->id, 'jenjang' => 'MI', 'paket' => 'MI', 'tahun_ajaran' => '2025/2026', 'jenis_id' => $jenis->id, 'nominal' => 100000]);

        $bayar = $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan->id, 'jumlah' => 40000,
        ])->assertStatus(201)->json('id');

        $this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/{$tagihan->id}/pembayaran")
            ->assertStatus(200)->assertJsonCount(1);

        // Hapus permanen menyesuaikan total tagihan.
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/pembayaran/{$bayar}")
            ->assertStatus(200);
        $this->assertDatabaseMissing('pembayaran', ['id' => $bayar]);
        $tagihan->refresh();
        $this->assertSame(0, $tagihan->terbayar);
        $this->assertSame('belum', $tagihan->status);

        // Menghapus pembayaran yang sudah batal tidak mengubah total.
        $bayar2 = $this->actingAs($admin)->postJson('/api/admin/keuangan/pembayaran', [
            'tagihan_id' => $tagihan->id, 'jumlah' => 30000,
        ])->assertStatus(201)->json('id');
        $this->actingAs($admin)->postJson("/api/admin/keuangan/pembayaran/{$bayar2}/batal")
            ->assertStatus(200);
        $this->actingAs($admin)->deleteJson("/api/admin/keuangan/pembayaran/{$bayar2}")
            ->assertStatus(200);
        $tagihan->refresh();
        $this->assertSame(0, $tagihan->terbayar);
    }
}
