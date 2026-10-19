<?php

namespace App\Console\Commands;

use App\Services\PapanService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use InvalidArgumentException;

#[Signature('papan:sebut
    {--modul= : Kode modul induk, mis. E (wajib untuk --buat)}
    {--kode= : Kode sub-modul, mis. E.3 (wajib)}
    {--kode-baru= : Kode pengganti}
    {--nama= : Nama sub-modul}
    {--buat : Tambah sub-modul baru}
    {--hapus : Hapus sub-modul beserta poinnya}
    {--yakin : Wajib menemani --hapus}')]
#[Description('Ubah nama/kode sub-modul papan, tambah baru, atau hapus tanpa menyentuh poin lain.')]
class PapanSebut extends Command
{
    /**
     * Kelola nama dan kode sub-modul papan.
     *
     * Ini jalan yang AMAN untuk mengganti nama/kode: poin di dalamnya
     * tidak dihapus, jadi id dan statusnya tetap. `db:seed PapanSeeder`
     * melakukan sebaliknya - poin dihapus lalu dibuat ulang dari cetak biru.
     */
    public function handle(PapanService $papan): int
    {
        $kode = (string) $this->option('kode');

        if (trim($kode) === '') {
            $this->error('Opsi --kode wajib diisi, mis. E.3.');

            return self::FAILURE;
        }

        try {
            return match (true) {
                (bool) $this->option('hapus') => $this->hapus($papan, $kode),
                (bool) $this->option('buat') => $this->buat($papan, $kode),
                default => $this->ubah($papan, $kode),
            };
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }

    /** Ubah nama dan/atau kode sub-modul. */
    private function ubah(PapanService $papan, string $kode): int
    {
        $kodeBaru = $this->option('kode-baru');
        $nama = $this->option('nama');

        if ($kodeBaru === null && $nama === null) {
            $this->error('Isi --nama dan/atau --kode-baru untuk mengubah sub-modul.');

            return self::FAILURE;
        }

        $item = $papan->item($kode);
        $item = $papan->ubahItem(
            $item->modul->kode,
            $kode,
            $kodeBaru === null ? null : (string) $kodeBaru,
            $nama === null ? null : (string) $nama,
        );

        $this->info("Sub-modul {$kode} kini {$item->kode} {$item->nama}.");
        $this->line('Poin di dalamnya tidak disentuh: id dan statusnya tetap.');

        return self::SUCCESS;
    }

    /** Tambah sub-modul baru di bawah sebuah modul. */
    private function buat(PapanService $papan, string $kode): int
    {
        $modul = (string) $this->option('modul');
        $nama = $this->option('nama');

        if (trim($modul) === '' || $nama === null) {
            $this->error('Untuk --buat, isi --modul dan --nama.');

            return self::FAILURE;
        }

        $item = $papan->tambahItem($modul, $kode, (string) $nama);

        $this->info("Sub-modul {$item->kode} ditambahkan ke modul {$modul}.");

        return self::SUCCESS;
    }

    /** Hapus sub-modul beserta seluruh poinnya. */
    private function hapus(PapanService $papan, string $kode): int
    {
        if (! $this->option('yakin')) {
            $this->error('Penghapusan menghapus SEMUA poin di dalamnya. Tambahkan --yakin bila benar-benar ingin.');

            return self::FAILURE;
        }

        $item = $papan->item($kode);
        $jumlah = $item->butir()->count();

        $papan->hapusItem($kode);

        $this->info("Sub-modul {$kode} dihapus beserta {$jumlah} poinnya.");

        return self::SUCCESS;
    }
}
