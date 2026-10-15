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
 * Rekap dampak dispensasi per PAKET × JENIS TAGIHAN: angka dihitung dari BARIS
 * TAGIHAN (bukan definisi paket), dan potongan tiap paket dihitung ulang dari
 * nominal kotor memakai aturan akumulatif yang sama seperti generate — supaya
 * baris tagihan berisi BEBERAPA paket tidak menghitung potongan yang sama dua
 * kali.
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

    private function jenis(string $nama, string $tipe = 'bulanan'): JenisTagihan
    {
        return JenisTagihan::firstOrCreate(['nama' => $nama], ['tipe' => $tipe]);
    }

    /** Paket dengan satu aturan persen untuk jenis tertentu (`null` = semua). */
    private function paket(string $nama, ?string $jenjang = null, ?int $jenisId = null, int $persen = 50): Dispensasi
    {
        $d = Dispensasi::create(['nama' => $nama, 'tahun_ajaran' => '2025/2026', 'jenjang' => $jenjang]);
        $d->aturan()->create(['jenis_id' => $jenisId, 'tipe' => 'persen', 'nilai' => $persen]);

        return $d;
    }

    /**
     * Satu baris tagihan atas `$jenis` dengan nominal TERSIMPAN & potongan
     * tersimpan yang diberikan (bukan hasil hitung — jejak apa adanya).
     *
     * @param  list<int>|null  $paketIds
     */
    private function tagihan(
        string $jenjang,
        JenisTagihan $jenis,
        ?array $paketIds,
        int $nominal,
        int $potongan,
        string $ta = '2025/2026',
        string $nama = 'Santri',
    ): Tagihan {
        $santri = Santri::create(['nama_lengkap' => $nama.' '.uniqid(), 'jk' => 'L']);

        return Tagihan::create([
            'santri_id' => $santri->id, 'jenjang' => $jenjang, 'tahun_ajaran' => $ta,
            'jenis_id' => $jenis->id, 'periode' => '2025-07', 'nominal' => $nominal,
            'potongan' => $potongan, 'dispensasi_ids' => $paketIds,
        ]);
    }

    public function test_rekap_mengelompokkan_per_paket_dan_jenis_tagihan(): void
    {
        $admin = $this->admin();
        $infaq = $this->jenis('Infaq Bulanan');
        $masuk = $this->jenis('Biaya Masuk', 'non_bulanan');
        $paketMi = $this->paket('Khusus MI', 'MI', $infaq->id);
        $paketGlobal = $this->paket('Semua Lembaga');

        // MI: tagihan Infaq dengan paket MI (potongan 50% dari 100.000 = 50.000).
        $this->tagihan('MI', $infaq, [$paketMi->id], 50000, 50000, nama: 'A');
        // MI: tagihan Biaya Masuk dengan paket global (potongan 50% dari 40.000).
        $this->tagihan('MI', $masuk, [$paketGlobal->id], 20000, 20000, nama: 'B');
        // MD: tagihan Infaq paket global.
        $this->tagihan('MD', $infaq, [$paketGlobal->id], 50000, 50000, nama: 'C');
        // Tanpa dispensasi → tidak ikut, baik null maupun larik kosong.
        $this->tagihan('MI', $infaq, null, 100000, 0, nama: 'D');
        $this->tagihan('MI', $infaq, [], 100000, 0, nama: 'E');

        $res = $this->actingAs($admin)->getJson('/api/admin/keuangan/dispensasi/rekap')->assertStatus(200);
        $data = collect($res->json('data'))->keyBy(fn ($r) => "{$r['jenjang']}|{$r['paket']}|{$r['jenis']}");

        $this->assertCount(3, $data);
        $this->assertSame(1, $data['MI|Khusus MI|Infaq Bulanan']['jumlah_tagihan']);
        $this->assertSame(50000, $data['MI|Khusus MI|Infaq Bulanan']['total_potongan']);
        $this->assertSame('MI', $data['MI|Khusus MI|Infaq Bulanan']['jenjang']);
        $this->assertSame('2025/2026', $data['MI|Khusus MI|Infaq Bulanan']['tahun_ajaran']);

        // Jenis tagihan memisahkan baris: paket global tampil sekali di Infaq
        // dan sekali di Biaya Masuk.
        $this->assertSame(20000, $data['MI|Semua Lembaga|Biaya Masuk']['total_potongan']);
        $this->assertSame(1, $data['MI|Semua Lembaga|Biaya Masuk']['jumlah_tagihan']);
        $this->assertSame(50000, $data['MD|Semua Lembaga|Infaq Bulanan']['total_potongan']);

        // Bawaan: urut lembaga → TA → paket → jenis.
        $this->assertSame(['MD', 'MI', 'MI'], array_column($res->json('data'), 'jenjang'));
    }

    public function test_potongan_baris_multi_paket_dihitung_ulang_bukan_digandakan(): void
    {
        $admin = $this->admin();
        // Dua paket berbeda aturan pada satu jenis: 50% persen, lalu potong
        // nominal Rp 10.000 atas sisa. Nominal kotor 100.000 → paket pertama
        // memotong 50.000, paket kedua 10.000, total potongan baris 60.000.
        $infaq = $this->jenis('Infaq Bulanan');
        $p1 = $this->paket('Paket Persen', null, $infaq->id, 50);
        $p2 = Dispensasi::create(['nama' => 'Paket Nominal', 'tahun_ajaran' => '2025/2026']);
        $p2->aturan()->create(['jenis_id' => $infaq->id, 'tipe' => 'nominal', 'nilai' => 10000]);

        $this->tagihan('MI', $infaq, [$p1->id, $p2->id], 40000, 60000, nama: 'A');

        $res = $this->actingAs($admin)->getJson('/api/admin/keuangan/dispensasi/rekap')->assertStatus(200);
        $data = collect($res->json('data'))->keyBy('paket');

        // Kalau potongan gabungan (60.000) ditempelkan ke TIAP paket, totalnya
        // jadi 120.000 — inilah yang dicegah: porsi paket pertama 50.000,
        // paket kedua 10.000, jumlahnya tetap sama dengan potongan tersimpan.
        $this->assertCount(2, $data);
        $this->assertSame(50000, $data['Paket Persen']['total_potongan']);
        $this->assertSame(10000, $data['Paket Nominal']['total_potongan']);
        $this->assertSame(60000, collect($res->json('data'))->sum('total_potongan'));
        $this->assertSame(1, $data['Paket Persen']['jumlah_tagihan']);
        $this->assertSame(1, $data['Paket Nominal']['jumlah_tagihan']);
    }

    public function test_rekap_memakai_potongan_tersimpan_bila_aturan_berubah(): void
    {
        $admin = $this->admin();
        // Aturan sekarang 50%, tetapi tagihan lama menyimpan potongan hanya
        // 30.000 dari nominal 100.000 (aturan dulu 30%). Rekam jejak tetap
        // dihormati: total porsi paket = potongan TERSIMPAN.
        $infaq = $this->jenis('Infaq Bulanan');
        $paket = $this->paket('Berubah', null, $infaq->id, 50);
        $this->tagihan('MI', $infaq, [$paket->id], 70000, 30000, nama: 'A');

        $res = $this->actingAs($admin)->getJson('/api/admin/keuangan/dispensasi/rekap')->assertStatus(200);

        $this->assertSame(30000, $res->json('data.0.total_potongan'));
    }

    public function test_rekap_menyaring_tahun_ajaran_dan_jenjang(): void
    {
        $admin = $this->admin();
        $infaq = $this->jenis('Infaq Bulanan');
        $paket = $this->paket('Semua Lembaga');
        $this->tagihan('MI', $infaq, [$paket->id], 50000, 50000, '2025/2026', 'A');
        $this->tagihan('MI', $infaq, [$paket->id], 20000, 80000, '2026/2027', 'B');
        $this->tagihan('MD', $infaq, [$paket->id], 90000, 10000, '2026/2027', 'C');

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/dispensasi/rekap?tahun_ajaran[]=2026/2027')
            ->assertStatus(200);
        $this->assertSame(['MD', 'MI'], array_column($res->json('data'), 'jenjang'));
        $data = collect($res->json('data'))->keyBy('jenjang');
        $this->assertSame(80000, $data['MI']['total_potongan']);
        $this->assertSame(10000, $data['MD']['total_potongan']);

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/dispensasi/rekap?jenjang[]=MI')
            ->assertStatus(200);
        $this->assertSame(['MI', 'MI'], array_column($res->json('data'), 'jenjang'));
        $this->assertSame(130000, collect($res->json('data'))->sum('total_potongan'));
    }

    public function test_rekap_menelusuri_satu_paket_ke_tiap_lembaga(): void
    {
        $admin = $this->admin();
        $infaq = $this->jenis('Infaq Bulanan');
        $paketMi = $this->paket('Khusus MI', 'MI', $infaq->id);
        $lain = $this->paket('Semua Lembaga');
        $this->tagihan('MI', $infaq, [$paketMi->id], 50000, 50000, nama: 'A');
        $this->tagihan('MD', $infaq, [$paketMi->id], 50000, 50000, nama: 'B'); // jejak lama lintas lembaga
        $this->tagihan('MI', $infaq, [$lain->id], 80000, 20000, nama: 'C');

        $res = $this->actingAs($admin)
            ->getJson("/api/admin/keuangan/dispensasi/rekap?dispensasi_id={$paketMi->id}")
            ->assertStatus(200);

        // Hanya baris paket MI, dan paket MI terlihat di MI DAN MD — inilah
        // yang dicari saat menelusuri kebocoran lingkup dari angkanya.
        $this->assertSame(['MD', 'MI'], array_column($res->json('data'), 'jenjang'));
        $this->assertSame('Khusus MI', $res->json('data.0.paket'));
        $this->assertSame(50000, $res->json('data.0.total_potongan'));
        $this->assertSame(50000, $res->json('data.1.total_potongan'));
    }

    public function test_rekap_urut_kolom_dan_kode_liar_ditolak(): void
    {
        $admin = $this->admin();
        $infaq = $this->jenis('Infaq Bulanan');
        $paket = $this->paket('Semua Lembaga');
        $this->tagihan('MI', $infaq, [$paket->id], 50000, 50000, nama: 'A');
        $this->tagihan('MD', $infaq, [$paket->id], 1000, 99000, nama: 'B');

        $res = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/dispensasi/rekap?sort=potongan&arah=turun')
            ->assertStatus(200);
        $this->assertSame(['MD', 'MI'], array_column($res->json('data'), 'jenjang'));
        $this->assertSame([99000, 50000], array_column($res->json('data'), 'total_potongan'));

        // Kode tak dikenal = 422 (allowlist UrutKatalog), bukan diabaikan.
        $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/dispensasi/rekap?sort=ngawur')
            ->assertStatus(422);
    }

    public function test_rekap_terbatas_pada_lingkup_lembaga_pengguna(): void
    {
        DB::table('lembaga')->insert(['nama' => 'MTS', 'jenjang' => 'MTS', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        $infaq = $this->jenis('Infaq Bulanan');
        $paket = $this->paket('Semua Lembaga');
        $this->tagihan('MI', $infaq, [$paket->id], 50000, 50000, nama: 'A');
        $this->tagihan('MD', $infaq, [$paket->id], 10000, 10000, nama: 'B');
        $this->tagihan('MTS', $infaq, [$paket->id], 5000, 5000, nama: 'C');

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
