<?php

namespace Tests\Feature;

use App\Models\JenisTagihan;
use App\Models\Lembaga;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pagination crosstab harus memotong di SQL, bukan sesudah seluruh tagihan
 * dimuat. Yang diuji: (1) `total` & `last_page` benar walau baris cuma satu
 * halaman, (2) halaman 2 tidak mengulang baris halaman 1, (3) setiap halaman
 * punya `total_tagihan`/`tunggakan` agregat SELURUH tagihan Santri itu (bukan
 * hanya yang kebetulan masuk halaman) — ini yang paling rawan rusak kalau
 * agregat ikut terpotong.
 */
class CrosstabPaginasiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Lembaga::create(['nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI']);
    }

    private function admin(): User
    {
        $u = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '081234567890', 'password' => 'password']);
        $u->assignRole('super_admin');

        return $u;
    }

    /** `$jumlah` Santri, tiap Santri 1 tagihan bulanan, semua jenjang & TA sama. */
    private function seedSantri(int $jumlah = 15): array
    {
        $admin = $this->admin();
        $infaq = JenisTagihan::create(['nama' => 'Infaq '.$jumlah, 'tipe' => 'bulanan']);

        $ids = [];
        for ($i = 1; $i <= $jumlah; $i++) {
            $s = Santri::create(['nama_lengkap' => sprintf('Santri %02d', $i), 'jk' => 'L']);
            $ids[] = $s->id;
            Tagihan::create([
                'santri_id' => $s->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
                'jenis_id' => $infaq->id, 'periode' => '2025-07', 'nominal' => 10000,
                'jatuh_tempo' => now()->addMonth()->toDateString(),
            ]);
        }

        return [$admin, $ids];
    }

    public function test_paginasi_memotong_di_sql_tanpa_memotong_agregat(): void
    {
        $admin = $this->admin();
        $infaq = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $lunas = JenisTagihan::create(['nama' => 'ASAS', 'tipe' => 'non_bulanan']);

        $nilai = [];
        for ($i = 1; $i <= 5; $i++) {
            $s = Santri::create(['nama_lengkap' => sprintf('Santri %02d', $i), 'jk' => 'L']);
            $nilai[] = $s->id;
            foreach (['2025-07', '2025-08', '2025-09'] as $bulan) {
                Tagihan::create([
                    'santri_id' => $s->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
                    'jenis_id' => $infaq->id, 'periode' => $bulan, 'nominal' => 10000 * $i,

                    'jatuh_tempo' => $bulan === '2025-07' ? now()->subDays(30)->toDateString() : now()->addMonth()->toDateString(),
                ]);
            }
            Tagihan::create([
                'santri_id' => $s->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
                'jenis_id' => $lunas->id, 'periode' => '2025/2026', 'nominal' => 50000 * $i,
                'jatuh_tempo' => now()->addMonths(6)->toDateString(),
            ]);
        }

        $halaman1 = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?per_page=2&page=1')->assertStatus(200)->json();
        $halaman2 = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?per_page=2&page=2')->assertStatus(200)->json();
        $halaman3 = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?per_page=2&page=3')->assertStatus(200)->json();

        $this->assertSame(5, $halaman1['total']);
        $this->assertSame(3, $halaman1['last_page']);
        $this->assertCount(2, $halaman1['baris']);
        $this->assertCount(2, $halaman2['baris']);
        $this->assertCount(1, $halaman3['baris']);

        $id1 = array_column($halaman1['baris'], 'santri_id');
        $id2 = array_column($halaman2['baris'], 'santri_id');
        $id3 = array_column($halaman3['baris'], 'santri_id');
        $this->assertSame([], array_intersect($id1, $id2));
        $this->assertSame([], array_intersect($id2, $id3));
        $this->assertCount(5, array_unique([...$id1, ...$id2, ...$id3]));

        $santriKedua = $halaman2['baris'][0];
        $expected = Tagihan::where('santri_id', $santriKedua['santri_id'])->sum('nominal');
        $this->assertSame($expected, $santriKedua['total_tagihan']);
        $this->assertSame(4, count($santriKedua['sel']), 'sel memuat 3 bulan + 1 non-bulanan');

        $expectedTunggakan = Tagihan::where('santri_id', $santriKedua['santri_id'])
            ->get()
            ->sum(fn ($t) => $t->sisaTerlambat());
        $this->assertSame($expectedTunggakan, $santriKedua['tunggakan']);

        $this->assertSame(4, count($halaman3['baris'][0]['sel']));
        $this->assertSame(
            ['1-2025-07', '1-2025-08', '1-2025-09', 'jenis-'.$lunas->id],
            array_column($halaman1['kolom'], 'key'),
        );

        $urut = function (string $arah) use ($admin) {
            return array_column($this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/crosstab?sort=nama&arah={$arah}&per_page=all")->json('baris'), 'nama');
        };
        $namaNaik = $urut('naik');
        $namaTurun = $urut('turun');
        $this->assertSame('Santri 01', $namaNaik[0], 'arah=naik harus menaik');
        $this->assertSame('Santri 05', $namaTurun[0], 'arah=turun harus menurun');
        $this->assertSame(array_reverse($namaNaik), $namaTurun);

        $totalTurun = array_column($this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?sort=total&arah=turun&per_page=all')->json('baris'), 'total_tagihan');
        $sorted = $totalTurun;
        rsort($sorted);
        $this->assertSame($sorted, $totalTurun);
    }

    public function test_halaman_di_luar_rentang_tidak_error(): void
    {
        $admin = $this->admin();
        $infaq = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $s = Santri::create(['nama_lengkap' => 'Santri Tunggal', 'jk' => 'P']);
        Tagihan::create([
            'santri_id' => $s->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
            'jenis_id' => $infaq->id, 'periode' => '2025-07', 'nominal' => 10000,
        ]);

        $res = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?per_page=50&page=9')->assertStatus(200)->json();
        $this->assertSame([], $res['baris']);
        $this->assertSame(1, $res['total']);
        $this->assertNotEmpty($res['kolom'], 'kolom tetap dikirim walau baris kosong');
        $this->assertSame(1, $res['last_page']);
    }

    public function test_halaman_berurutan_tidak_duplikat_atau_hilang(): void
    {
        [$admin, $santri] = $this->seedSantri();

        $ambil = function (int $halaman) use ($admin) {
            return $this->actingAs($admin)->getJson("/api/admin/keuangan/tagihan/crosstab?sort=nama&arah=naik&per_page=10&page={$halaman}")->json();
        };

        $p1 = $ambil(1);
        $this->assertSame(10, count($p1['baris']));
        $this->assertSame('Santri 01', $p1['baris'][0]['nama']);

        $p2 = $ambil(2);
        $this->assertSame(5, count($p2['baris']));
        $this->assertSame(2, $p2['last_page']);
        $this->assertSame('Santri 11', $p2['baris'][0]['nama'], 'halaman 2 lanjutan, bukan ulang');

        $id1 = array_column($p1['baris'], 'santri_id');
        $id2 = array_column($p2['baris'], 'santri_id');
        $this->assertSame([], array_values(array_intersect($id1, $id2)), 'tidak boleh ada baris di dua halaman');
        $this->assertCount(15, array_unique([...$id1, ...$id2]), 'semua 15 Santri harus tepat satu kali');

        $luar = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?sort=nama&arah=naik&per_page=10&page=99')->json();
        $this->assertSame(15, $luar['total']);
        $this->assertSame(2, $luar['last_page']);
        $this->assertSame([], $luar['baris']);
    }

    public function test_per_page_all_memuat_seluruh_santri(): void
    {
        [$admin] = $this->seedSantri();

        $semua = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?sort=nama&arah=naik&per_page=all')->json();

        $this->assertSame(15, $semua['total']);
        $this->assertCount(15, $semua['baris']);
        $this->assertSame(1, $semua['last_page']);
        $this->assertSame('Santri 01', $semua['baris'][0]['nama']);
        $this->assertSame('Santri 15', $semua['baris'][14]['nama']);
    }

    public function test_kolom_crosstab_mengikuti_urutan_jenis(): void
    {
        $admin = $this->admin();
        $infaq = JenisTagihan::create(['nama' => 'Infaq', 'tipe' => 'bulanan']);
        $asas = JenisTagihan::create(['nama' => 'ASAS', 'tipe' => 'non_bulanan']);
        $ujian = JenisTagihan::create(['nama' => 'Ujian', 'tipe' => 'non_bulanan']);

        $s = Santri::create(['nama_lengkap' => 'Santri 01', 'jk' => 'L']);
        foreach ([[$infaq->id, '2025-07'], [$asas->id, '2025/2026'], [$ujian->id, '2025/2026']] as [$jenisId, $periode]) {
            Tagihan::create([
                'santri_id' => $s->id, 'jenjang' => 'MI', 'tahun_ajaran' => '2025/2026',
                'jenis_id' => $jenisId, 'periode' => $periode, 'nominal' => 10000,
            ]);
        }

        $kunci = fn (): array => array_column(
            $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?per_page=all')->json('kolom'),
            'key',
        );

        $this->assertSame(['1-2025-07', 'jenis-'.$asas->id, 'jenis-'.$ujian->id], $kunci());

        $ujian->update(['urutan' => 1]);
        $this->assertSame(['jenis-'.$ujian->id, '1-2025-07', 'jenis-'.$asas->id], $kunci());

        $asas->update(['urutan' => 2]);
        $this->assertSame(['jenis-'.$ujian->id, 'jenis-'.$asas->id, '1-2025-07'], $kunci());

        $asas->update(['urutan' => 1]);
        $this->assertSame(['jenis-'.$asas->id, 'jenis-'.$ujian->id, '1-2025-07'], $kunci());

        $kolomPertama = $this->actingAs($admin)
            ->getJson('/api/admin/keuangan/tagihan/crosstab?per_page=all')
            ->json('kolom.0');
        $this->assertSame(['key', 'jenis_id', 'jenis_nama', 'tipe', 'periode'], array_keys($kolomPertama));
    }

    public function test_agregat_halaman_ikut_benar(): void
    {
        [$admin, $santri] = $this->seedSantri();

        $h2 = $this->actingAs($admin)->getJson('/api/admin/keuangan/tagihan/crosstab?sort=nama&arah=naik&per_page=10&page=2')->json('baris');

        $santriId = $h2[0]['santri_id'];
        $tagihan = Tagihan::where('santri_id', $santriId)->get();
        $this->assertSame(
            (int) $tagihan->sum('nominal'),
            $h2[0]['total_tagihan'],
            'total harus jumlah nominal tagihan Santri tsb',
        );
        $this->assertSame(
            (int) $tagihan->filter(fn ($t) => $t->terlambat())->sum(fn ($t) => $t->sisa()),
            $h2[0]['tunggakan'],
            'tunggakan harus sisa tagihan yang lewat batas waktu',
        );
    }
}
