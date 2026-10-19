<?php

namespace Tests\Feature;

use App\Models\Papan\PapanItem;
use App\Models\Papan\PapanModul;
use App\Models\Papan\PapanRiwayat;
use App\Services\PapanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * Logika papan perkembangan proyek: validasi status, jejak riwayat, dan
 * operasi poin. Memakai koneksi `papan` (SQLite terpisah) — skema dibangun
 * sekali di setUp karena `RefreshDatabase` hanya menyentuh koneksi default.
 *
 * Sejak status pindah ke POIN, test di sini memindahkan butir (bukan
 * sub-modul) dan memeriksa bahwa status sub-modulnya ikut mengikuti.
 */
class PapanServiceTest extends TestCase
{
    use RefreshDatabase;

    private PapanService $papan;

    protected function setUp(): void
    {
        parent::setUp();

        $this->siapkanSkema();

        $this->papan = app(PapanService::class);
    }

    public function test_pindah_butir_mengubah_status_dan_mencatat_riwayat(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['akan']);
        $butir = $item->butir()->firstOrFail();

        $hasil = $this->papan->pindahButir('E.3', (int) $butir->id, 'sedang', 'agent', 'Mulai rekap per kas');

        $this->assertSame('sedang', $hasil->status);
        $this->assertDatabaseHas('papan_riwayat', [
            'item_id' => $item->id,
            'butir_id' => $butir->id,
            'dari_status' => 'akan',
            'ke_status' => 'sedang',
            'catatan' => 'Mulai rekap per kas',
            'diubah_oleh' => 'agent',
        ], 'papan');
    }

    public function test_pindah_menolak_status_di_luar_daftar(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['akan']);

        $this->expectException(InvalidArgumentException::class);

        $this->papan->pindahButir('E.3', (int) $item->butir()->firstOrFail()->id, 'ngarang');
    }

    public function test_pindah_menolak_kode_yang_tidak_ada(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->papan->pindahButir('Z.9', 1, 'sedang');
    }

    public function test_pindah_menolak_butir_yang_tidak_ada(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['akan']);

        $this->expectException(InvalidArgumentException::class);

        $this->papan->pindahButir('E.3', 99999, 'sedang');
    }

    public function test_pindah_ke_status_sama_tanpa_catatan_tidak_menambah_riwayat(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['akan']);

        $this->papan->pindahButir('E.3', (int) $item->butir()->firstOrFail()->id, 'akan');

        $this->assertSame(0, PapanRiwayat::count());
    }

    public function test_riwayat_urut_terbaru_lebih_dulu(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['akan']);
        $id = (int) $item->butir()->firstOrFail()->id;

        $this->papan->pindahButir('E.3', $id, 'sedang', 'agent', 'mulai');
        $this->papan->pindahButir('E.3', $id, 'sudah', 'pengguna', 'selesai');

        $baris = $this->papan->riwayat('E.3');

        $this->assertCount(2, $baris);
        $this->assertSame('sudah', $baris[0]['ke']);
        $this->assertSame('pengguna', $baris[0]['oleh']);
        $this->assertSame('sedang', $baris[1]['ke']);
        // Riwayat kini menunjuk poin yang berpindah, bukan cuma sub-modul.
        $this->assertSame('Rekap per kas.', $baris[0]['butir']);
    }

    public function test_tambah_butir_menempatkan_urutan_terakhir(): void
    {
        // Sub-modul ini sudah punya satu poin, jadi poin baru harus menyusul
        // di urutan berikutnya — bukan mengulang dari 1.
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['akan']);

        $kedua = $this->papan->tambahButir('E.3', 'akan', 'Butir kedua.');
        $ketiga = $this->papan->tambahButir('E.3', 'sudah', 'Butir ketiga.');

        $this->assertSame(2, $kedua->urutan);
        $this->assertSame(3, $ketiga->urutan);
        $this->assertSame('sudah', $ketiga->status);
    }

    public function test_tambah_butir_menolak_status_di_luar_daftar(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['akan']);

        $this->expectException(InvalidArgumentException::class);

        $this->papan->tambahButir('E.3', 'ngarang', 'Tidak sah.');
    }

    public function test_hapus_butir_menolak_butir_milik_sub_modul_lain(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', []);
        $this->buatItem('E.4', 'Tunggakan', []);

        $butir = $this->papan->tambahButir('E.4', 'akan', 'Milik E.4.');

        $this->assertFalse($this->papan->hapusButir('E.3', (int) $butir->id));
        $this->assertDatabaseHas('papan_butir', ['id' => $butir->id], 'papan');
    }

    public function test_ringkasan_memisahkan_poin_dan_sub_modul(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['akan', 'sudah']);
        $this->buatItem('E.4', 'Tunggakan', ['sudah', 'sudah']);

        $ringkasan = $this->papan->ringkasan();

        // Poin: 3 sudah, 1 akan.
        $this->assertSame(3, $ringkasan['butir']['sudah']);
        $this->assertSame(1, $ringkasan['butir']['akan']);
        // Sub-modul turunan: E.4 sudah (semua poinnya sudah), E.3 masih akan.
        $this->assertSame(1, $ringkasan['sub']['sudah']);
        $this->assertSame(1, $ringkasan['sub']['akan']);
    }

    /**
     * Semua poin di sub-modul yang sama diberi status sama; yang menentukan
     * status sub-modul adalah sebaran poinnya, bukan nilai di sub-modul itu.
     *
     * @param  array<int, string>  $statusButir
     */
    private function buatItem(string $kode, string $nama, array $statusButir = []): PapanItem
    {
        $modul = PapanModul::query()->firstOrCreate(
            ['kode' => 'E'],
            ['nama' => 'Keuangan', 'urutan' => 1],
        );

        $item = PapanItem::create([
            'modul_id' => $modul->id,
            'kode' => $kode,
            'nama' => $nama,
            'urutan' => 1,
        ]);

        foreach ($statusButir as $i => $status) {
            $item->butir()->create([
                'status' => $status,
                'deskripsi' => $i === 0 ? 'Rekap per kas.' : 'Butir '.($i + 1).'.',
                'urutan' => $i + 1,
            ]);
        }

        return $item;
    }

    /** Bangun skema papan di koneksi `papan` (in-memory saat tes). */
    private function siapkanSkema(): void
    {
        config()->set('database.connections.papan.database', ':memory:');

        $this->artisan('migrate', [
            '--path' => 'database/migrations/papan',
            '--database' => 'papan',
            '--force' => true,
        ])->run();
    }
}
