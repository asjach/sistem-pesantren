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
 * operasi butir. Memakai koneksi \`papan\` (SQLite terpisah) — skema dibangun
 * sekali di setUp karena \`RefreshDatabase\` hanya menyentuh koneksi default.
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

    public function test_pindah_mengubah_status_dan_mencatat_riwayat(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', 'akan');

        $item = $this->papan->pindah('E.3', 'sedang', 'agent', 'Mulai rekap per kas');

        $this->assertSame('sedang', $item->status);
        $this->assertDatabaseHas('papan_riwayat', [
            'item_id' => $item->id,
            'dari_status' => 'akan',
            'ke_status' => 'sedang',
            'catatan' => 'Mulai rekap per kas',
            'diubah_oleh' => 'agent',
        ], 'papan');
    }

    public function test_pindah_menolak_status_di_luar_daftar(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', 'akan');

        $this->expectException(InvalidArgumentException::class);

        $this->papan->pindah('E.3', 'ngarang');
    }

    public function test_pindah_menolak_kode_yang_tidak_ada(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->papan->pindah('Z.9', 'sedang');
    }

    public function test_pindah_ke_status_sama_tanpa_catatan_tidak_menambah_riwayat(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', 'akan');

        $this->papan->pindah('E.3', 'akan');

        $this->assertSame(0, PapanRiwayat::count());
    }

    public function test_riwayat_urut_terbaru_lebih_dulu(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', 'akan');

        $this->papan->pindah('E.3', 'sedang', 'agent', 'mulai');
        $this->papan->pindah('E.3', 'sudah', 'pengguna', 'selesai');

        $baris = $this->papan->riwayat('E.3');

        $this->assertCount(2, $baris);
        $this->assertSame('sudah', $baris[0]['ke']);
        $this->assertSame('pengguna', $baris[0]['oleh']);
        $this->assertSame('sedang', $baris[1]['ke']);
    }

    public function test_tambah_butir_menempatkan_urutan_terakhir(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', 'akan');

        $pertama = $this->papan->tambahButir('E.3', 'akan', 'Butir pertama.');
        $kedua = $this->papan->tambahButir('E.3', 'sudah', 'Butir kedua.');

        $this->assertSame(1, $pertama->urutan);
        $this->assertSame(2, $kedua->urutan);
        $this->assertSame('sudah', $kedua->status);
    }

    public function test_tambah_butir_menolak_status_di_luar_daftar(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', 'akan');

        $this->expectException(InvalidArgumentException::class);

        $this->papan->tambahButir('E.3', 'ngarang', 'Tidak sah.');
    }

    public function test_hapus_butir_menolak_butir_milik_sub_modul_lain(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', 'akan');
        $this->buatItem('E.4', 'Tunggakan', 'sudah');

        $butir = $this->papan->tambahButir('E.4', 'akan', 'Milik E.4.');

        $this->assertFalse($this->papan->hapusButir('E.3', (int) $butir->id));
        $this->assertDatabaseHas('papan_butir', ['id' => $butir->id], 'papan');
    }

    public function test_ringkasan_menghitung_sub_modul_per_status(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', 'akan');
        $this->buatItem('E.4', 'Tunggakan', 'sudah');
        $this->buatItem('E.5', 'Audit & Kontrol', 'sudah');

        $ringkasan = $this->papan->ringkasan();

        $this->assertSame(2, $ringkasan['sudah']);
        $this->assertSame(1, $ringkasan['akan']);
        $this->assertSame(0, $ringkasan['sedang']);
        $this->assertSame(0, $ringkasan['ditunda']);
    }

    /** Buat modul + sub-modul minimal untuk pengujian. */
    private function buatItem(string $kode, string $nama, string $status): PapanItem
    {
        $modul = PapanModul::query()->firstOrCreate(
            ['kode' => 'E'],
            ['nama' => 'Keuangan', 'urutan' => 1],
        );

        return PapanItem::create([
            'modul_id' => $modul->id,
            'kode' => $kode,
            'nama' => $nama,
            'status' => $status,
            'urutan' => 1,
        ]);
    }

    /** Bangun skema papan di koneksi \`papan\` (in-memory saat tes). */
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
