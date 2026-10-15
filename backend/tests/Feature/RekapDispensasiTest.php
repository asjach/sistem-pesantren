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

/**
 * Rekap dampak dispensasi per lembaga: angka dihitung dari BARIS TAGIHAN
 * (bukan definisi paket), jadi lanjutan dari penjagaan lingkup `jenjang` —
 * paket berlingkup MI yang angkanya muncul di lembaga MD langsung terbaca.
 */
class RekapDispensasiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        DB::table('lembaga')->insert([
            ['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['nama' => 'MD', 'jenjang' => 'MD', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
        TahunAjaran::create(['nama' => '2025/2026']);
        TahunAjaran::create(['nama' => '2026/2027']);
    }

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    private function paket(string $nama, ?string $jenjang = null): Dispensasi
    {
        $jenis = JenisTagihan::firstOrCreate(['nama' => 'Infaq Bulanan'], ['tipe' => 'bulanan']);
        $d = Dispensasi::create(['nama' => $nama, 'tahun_ajaran' => '2025/2026', 'jenjang' => $jenjang]);
        $d->aturan()->create(['jenis_id' => $jenis->id, 'tipe' => 'persen', 'nilai' => 50]);

        return $d;
    }

    /** @param  list<int>|null  $paketIds  null = tanpa paket */
    private function tagihan(string $jenjang, ?array $paketIds, int $potongan, string $ta = '2025/2026', string $nama = 'Santri'): Tagihan
    {
        $jenis = JenisTagihan::where('nama', 'Infaq Bulanan')->firstOrFail();
        $santri = Santri::create(['nama_lengkap' => $nama.' '.uniqid(), 'jk' => 'L']);

        return Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => $jenjang, 'tahun_ajaran' => $ta,
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => 100000 - $potongan,
            'potongan' => $potongan, 'dispensasi_ids' => $paketIds,
        ]);
    }

    public function test_rekap_menghitung_tagihan_penerima_dan_potongan_per_lembaga(): void
    {
        $admin = $this->admin();
        $paketMi = $this->paket('Khusus MI', 'MI');
        $paketGlobal = $this->paket('Semua Lembaga');

        // MI: dua tagihan (satu paket sama + satu paket global) = 2 tagihan,
        // 2 penerima, potongan 50.000, 2 paket berbeda.
        $this->tagihan('MI', [$paketMi->id], 25000, nama: 'A');
        $this->tagihan('MI', [$paketGlobal->id], 25000, nama: 'B');
        // MD: satu tagihan paket global.
        $this->tagihan('MD', [$paketGlobal->id], 10000, nama: 'C');
        // Tanpa dispensasi → tidak ikut dihitung, baik null maupun larik
        // kosong (baris lama yang sempat menyimpan `[]`).
        $this->tagihan('MI', null, 0, nama: 'D');
        $this->tagihan('MI', [], 0, nama: 'E');

        $res = $this->actingAs($admin)->getJson('/api/admin/keuangan/dispensasi/rekap')->assertStatus(200);
        $data = collect($res->json('data'))->keyBy('jenjang');

        $this->assertSame(2, $data['MI']['jumlah_tagihan']);
        $this->assertSame(2, $data['MI']['jumlah_penerima']);
        $this->assertSame(50000, $data['MI']['total_potongan']);
        $this->assertSame(2, $data['MI']['jumlah_paket']);

        $this->assertSame(1, $data['MD']['jumlah_tagihan']);
        $this->assertSame(10000, $data['MD']['total_potongan']);
        $this->assertSame(1, $data['MD']['jumlah_paket']);

        // Bawaan: urut jenjang menaik (MD < MI), dan lembaga tanpa tagihan
        // berdispensasi tidak muncul sebagai baris nol.
        $this->assertSame(['MD', 'MI'], array_column($res->json('data'), 'jenjang'));
    }

    public function test_rekap_menyaring_tahun_ajaran_dan_jenjang(): void
    {
        $admin = $this->admin();
        $paket = $this->paket('Semua Lembaga');
        $this->tagihan('MI', [$paket->id], 25000, '2025/2026', 'A');
        $this->tagihan('MI', [$paket->id], 40000, '2026/2027', 'B');
        $this->tagihan('MD', [$paket->id], 10000, '2026/2027', 'C');

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/dispensasi/rekap?tahun_ajaran[]=2026/2027')
            ->assertStatus(200);
        $data = collect($res->json('data'))->keyBy('jenjang');
        $this->assertSame(['MD', 'MI'], collect($res->json('data'))->pluck('jenjang')->sort()->values()->all());
        $this->assertSame(40000, $data['MI']['total_potongan']);
        $this->assertSame(10000, $data['MD']['total_potongan']);

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/dispensasi/rekap?jenjang[]=MI')
            ->assertStatus(200);
        $this->assertSame(['MI'], array_column($res->json('data'), 'jenjang'));
        $this->assertSame(65000, $res->json('data.0.total_potongan'));
    }

    public function test_rekap_menelusuri_satu_paket_ke_tiap_lembaga(): void
    {
        $admin = $this->admin();
        $paketMi = $this->paket('Khusus MI', 'MI');
        $lain = $this->paket('Semua Lembaga');
        $this->tagihan('MI', [$paketMi->id], 25000, nama: 'A');
        $this->tagihan('MD', [$paketMi->id], 25000, nama: 'B'); // jejak lama lintas lembaga
        $this->tagihan('MI', [$lain->id], 10000, nama: 'C');

        $res = $this->actingAs($admin)
            ->getJson("/api/admin/keuangan/dispensasi/rekap?dispensasi_id={$paketMi->id}")
            ->assertStatus(200);

        // Paket MI terlihat di MI DAN MD — inilah yang dicari saat menelusuri
        // kebocoran lingkup dari angkanya (bawaan urut jenjang menaik).
        $this->assertSame(['MD', 'MI'], array_column($res->json('data'), 'jenjang'));
        $this->assertSame(25000, $res->json('data.0.total_potongan'));
        $this->assertSame(25000, $res->json('data.1.total_potongan'));
    }

    public function test_rekap_urut_kolom_dan_kode_liar_ditolak(): void
    {
        $admin = $this->admin();
        $paket = $this->paket('Semua Lembaga');
        $this->tagihan('MI', [$paket->id], 25000, nama: 'A');
        $this->tagihan('MD', [$paket->id], 99000, nama: 'B');

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/dispensasi/rekap?sort=potongan&arah=turun')
            ->assertStatus(200);
        $this->assertSame(['MD', 'MI'], array_column($res->json('data'), 'jenjang'));

        // Kode tak dikenal = 422 (allowlist UrutKatalog), bukan diabaikan.
        $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/dispensasi/rekap?sort=ngawur')
            ->assertStatus(422);
    }

    public function test_rekap_terbatas_pada_lingkup_lembaga_pengguna(): void
    {
        DB::table('lembaga')->insert(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        $paket = $this->paket('Semua Lembaga');
        $this->tagihan('MI', [$paket->id], 25000, nama: 'A');
        $this->tagihan('MD', [$paket->id], 10000, nama: 'B');
        $this->tagihan('MTS', [$paket->id], 5000, nama: 'C');

        $adminMi = User::create(['name' => 'Admin MI', 'email' => 'adminmi@example.com', 'phone' => '081234567891', 'password' => 'password']);
        $adminMi->assignRole('admin');
        DB::table('user_lembaga')->insert([
            'user_id' => $adminMi->id, 'jenjang' => 'MI', 'created_at' => now(), 'updated_at' => now(),
        ]);

        // Tanpa filter: lingkup pivot + pasangan MI↔MD (aturan `canAccessLembaga`),
        // jadi MTS tidak muncul.
        $res = $this->actingAs($adminMi)->getJson('/api/admin/keuangan/dispensasi/rekap')->assertStatus(200);
        $this->assertSame(['MD', 'MI'], array_column($res->json('data'), 'jenjang'));

        // Minta lembaga di luar lingkup = 403 (bukan diam-diam dikosongkan).
        $this->actingAs($adminMi)
            ->getJson('/api/admin/keuangan/dispensasi/rekap?jenjang[]=MTS')
            ->assertStatus(403);
    }
}
