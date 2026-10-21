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
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);
        $butir = $item->butir()->firstOrFail();

        $hasil = $this->papan->pindahButir('E.3', (int) $butir->id, 'in_progress', 'agent', 'Mulai rekap per kas');

        $this->assertSame('in_progress', $hasil->status);
        $this->assertDatabaseHas('papan_riwayat', [
            'item_id' => $item->id,
            'butir_id' => $butir->id,
            'dari_status' => 'todo',
            'ke_status' => 'in_progress',
            'catatan' => 'Mulai rekap per kas',
            'diubah_oleh' => 'agent',
        ], 'papan');
    }

    public function test_pindah_menolak_status_di_luar_daftar(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);

        $this->expectException(InvalidArgumentException::class);

        $this->papan->pindahButir('E.3', (int) $item->butir()->firstOrFail()->id, 'ngarang');
    }

    public function test_pindah_menolak_kode_yang_tidak_ada(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->papan->pindahButir('Z.9', 1, 'in_progress');
    }

    public function test_pindah_menolak_butir_yang_tidak_ada(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);

        $this->expectException(InvalidArgumentException::class);

        $this->papan->pindahButir('E.3', 99999, 'in_progress');
    }

    public function test_pindah_ke_status_sama_tanpa_catatan_tidak_menambah_riwayat(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);

        $this->papan->pindahButir('E.3', (int) $item->butir()->firstOrFail()->id, 'todo');

        $this->assertSame(0, PapanRiwayat::count());
    }

    public function test_riwayat_urut_terbaru_lebih_dulu(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);
        $id = (int) $item->butir()->firstOrFail()->id;

        $this->papan->pindahButir('E.3', $id, 'in_progress', 'agent', 'mulai');
        $this->papan->pindahButir('E.3', $id, 'done', 'pengguna', 'selesai');

        $baris = $this->papan->riwayat('E.3');

        $this->assertCount(2, $baris);
        $this->assertSame('done', $baris[0]['ke']);
        $this->assertSame('pengguna', $baris[0]['oleh']);
        $this->assertSame('in_progress', $baris[1]['ke']);
        // Riwayat kini menunjuk poin yang berpindah, bukan cuma sub-modul.
        $this->assertSame('Rekap per kas.', $baris[0]['butir']);
    }

    public function test_tambah_butir_menempatkan_urutan_terakhir(): void
    {
        // Sub-modul ini sudah punya satu poin, jadi poin baru harus menyusul
        // di urutan berikutnya — bukan mengulang dari 1.
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);

        $kedua = $this->papan->tambahButir('E.3', 'todo', 'Butir kedua.');
        $ketiga = $this->papan->tambahButir('E.3', 'done', 'Butir ketiga.');

        $this->assertSame(2, $kedua->urutan);
        $this->assertSame(3, $ketiga->urutan);
        $this->assertSame('done', $ketiga->status);
    }

    public function test_tambah_butir_menolak_status_di_luar_daftar(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);

        $this->expectException(InvalidArgumentException::class);

        $this->papan->tambahButir('E.3', 'ngarang', 'Tidak sah.');
    }

    public function test_hapus_butir_menolak_butir_milik_sub_modul_lain(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', []);
        $this->buatItem('E.4', 'Tunggakan', []);

        $butir = $this->papan->tambahButir('E.4', 'todo', 'Milik E.4.');

        $this->assertFalse($this->papan->hapusButir('E.3', (int) $butir->id));
        $this->assertDatabaseHas('papan_butir', ['id' => $butir->id], 'papan');
    }

    public function test_ringkasan_memisahkan_poin_dan_sub_modul(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo', 'done']);
        $this->buatItem('E.4', 'Tunggakan', ['done', 'done']);

        $ringkasan = $this->papan->ringkasan();

        // Poin: 3 Done, 1 To Do.
        $this->assertSame(3, $ringkasan['butir']['done']);
        $this->assertSame(1, $ringkasan['butir']['todo']);
        // Sub-modul turunan: E.4 Done, E.3 masih To Do.
        $this->assertSame(1, $ringkasan['sub']['done']);
        $this->assertSame(1, $ringkasan['sub']['todo']);
    }

    public function test_ubah_butir_mengganti_deskripsi_tanpa_menyentuh_riwayat(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);
        $butir = $item->butir()->firstOrFail();

        $hasil = $this->papan->ubahButir('E.3', (int) $butir->id, 'Rekap per kas harian.');

        $this->assertSame('Rekap per kas harian.', $hasil->deskripsi);
        $this->assertSame('todo', $hasil->status, 'Status tidak boleh ikut berubah.');
        // Menyunting teks bukan perpindahan status: riwayat tidak ditambah,
        // supaya tidak dipenuhi baris palsu "todo -> todo".
        $this->assertSame(0, PapanRiwayat::query()->count());
    }

    public function test_tambah_dan_ubah_butir_menyimpan_keterangan(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);

        $butir = $this->papan->tambahButir('E.3', 'todo', 'Poin berketerangan.', [], 'Catatan awal.');
        $this->assertSame('Catatan awal.', $butir->keterangan);

        $hasil = $this->papan->ubahButir('E.3', (int) $butir->id, null, null, 'agent', null, null, '');
        $this->assertNull($hasil->keterangan);
    }

    public function test_ubah_butir_mengganti_status_dan_mencatat_riwayat(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);
        $butir = $item->butir()->firstOrFail();

        $hasil = $this->papan->ubahButir('E.3', (int) $butir->id, null, 'done', 'pengguna');

        $this->assertSame('done', $hasil->status);
        $this->assertDatabaseHas('papan_riwayat', [
            'butir_id' => $butir->id,
            'dari_status' => 'todo',
            'ke_status' => 'done',
            'diubah_oleh' => 'pengguna',
        ], 'papan');
    }

    public function test_ubah_butir_menolak_status_di_luar_daftar(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo']);

        $this->expectException(InvalidArgumentException::class);

        $this->papan->ubahButir('E.3', (int) $item->butir()->firstOrFail()->id, null, 'ngarang');
    }

    public function test_geser_butir_menukar_urutan_dan_merapatkannya(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo', 'todo', 'todo']);
        $id = $item->butir()->orderBy('urutan')->pluck('id')->all();

        $this->assertTrue($this->papan->geserButir('E.3', (int) $id[2], -1));

        $urut = $item->butir()->orderBy('urutan')->pluck('id')->all();
        $this->assertSame([$id[0], $id[2], $id[1]], $urut);
        // Urutan ditulis rapat 1..n supaya tidak ada lubang.
        $this->assertSame([1, 2, 3], $item->butir()->orderBy('urutan')->pluck('urutan')->all());
    }

    public function test_geser_butir_di_ujung_mengembalikan_false(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo', 'todo']);
        $id = $item->butir()->orderBy('urutan')->pluck('id')->all();

        $this->assertFalse($this->papan->geserButir('E.3', (int) $id[0], -1), 'Poin teratas tidak bisa naik.');
        $this->assertFalse($this->papan->geserButir('E.3', (int) $id[1], 1), 'Poin terbawah tidak bisa turun.');
    }

    public function test_ubah_item_mengganti_nama_dan_kode_tanpa_menyentuh_poin(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['done', 'todo']);
        $idButir = $item->butir()->pluck('id')->all();

        $hasil = $this->papan->ubahItem('E', 'E.3', 'E.9', 'Rekap Kas Baru');

        $this->assertSame('E.9', $hasil->kode);
        $this->assertSame('Rekap Kas Baru', $hasil->nama);
        // Poin harus SELAMAT: ini pembeda dari seed ulang, yang menghapus
        // lalu membuat ulang poin sehingga id dan status tanda tangannya hilang.
        $this->assertSame($idButir, $hasil->butir()->pluck('id')->all());
        $this->assertSame(['done', 'todo'], $hasil->butir()->orderBy('urutan')->pluck('status')->all());
    }

    public function test_ubah_item_menolak_kode_yang_sudah_dipakai(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas');
        $this->buatItem('E.4', 'Tutup Buku');

        $this->expectException(InvalidArgumentException::class);

        $this->papan->ubahItem('E', 'E.3', 'E.4');
    }

    public function test_tambah_item_menempatkan_urutan_terakhir_dan_menolak_kode_kembar(): void
    {
        $this->buatItem('E.3', 'Rekap & Tutup Buku Kas');

        $baru = $this->papan->tambahItem('E', 'E.7', 'Laporan Kas');
        $this->assertSame('E.7', $baru->kode);
        $this->assertSame(2, $baru->urutan);

        $this->expectException(InvalidArgumentException::class);
        $this->papan->tambahItem('E', 'E.7', 'Kembar');
    }

    public function test_hapus_item_ikut_menghapus_poinnya(): void
    {
        $item = $this->buatItem('E.3', 'Rekap & Tutup Buku Kas', ['todo', 'done']);

        $this->assertTrue($this->papan->hapusItem('E.3'));

        $this->assertSame(0, PapanItem::query()->where('kode', 'E.3')->count());
        // Cascade harus benar-benar jalan, bukan meninggalkan poin yatim
        // yang tak bisa dijangkau UI mana pun.
        $this->assertSame(0, $item->butir()->count());
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
