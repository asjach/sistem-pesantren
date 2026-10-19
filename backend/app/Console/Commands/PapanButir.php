<?php

namespace App\Console\Commands;

use App\Services\PapanService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use InvalidArgumentException;

#[Signature('papan:butir
    {aksi : tambah | hapus}
    {kode : Kode sub-modul, mis. E.3}
    {--id= : Id butir (wajib untuk hapus)}
    {--status=sudah : Status butir baru: sudah | sedang | akan | ditunda}
    {--deskripsi= : Isi butir (wajib untuk tambah)}')]
#[Description('Tambah atau hapus butir di bawah sebuah sub-modul papan.')]
class PapanButir extends Command
{
    /** Jalankan aksi tambah/hapus butir. */
    public function handle(PapanService $papan): int
    {
        $aksi = (string) $this->argument('aksi');
        $kode = (string) $this->argument('kode');

        try {
            return match ($aksi) {
                'tambah' => $this->tambah($papan, $kode),
                'hapus' => $this->hapus($papan, $kode),
                default => $this->aksiTidakDikenal($aksi),
            };
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }

    /** Tambah butir baru berstatus tertentu. */
    private function tambah(PapanService $papan, string $kode): int
    {
        $deskripsi = (string) $this->option('deskripsi');

        if (trim($deskripsi) === '') {
            $this->error('Opsi --deskripsi wajib diisi untuk aksi tambah.');

            return self::FAILURE;
        }

        $status = (string) $this->option('status');
        $butir = $papan->tambahButir($kode, $status, trim($deskripsi));

        $this->info("Butir #{$butir->id} ditambahkan ke {$kode} [{$butir->status}].");

        return self::SUCCESS;
    }

    /** Hapus butir milik sebuah sub-modul. */
    private function hapus(PapanService $papan, string $kode): int
    {
        $id = $this->option('id');

        if (! is_numeric($id)) {
            $this->error('Opsi --id wajib diisi (angka) untuk aksi hapus.');

            return self::FAILURE;
        }

        if (! $papan->hapusButir($kode, (int) $id)) {
            $this->error("Butir #{$id} tidak ditemukan di {$kode}.");

            return self::FAILURE;
        }

        $this->info("Butir #{$id} dihapus dari {$kode}.");

        return self::SUCCESS;
    }

    /** Aksi di luar tambah/hapus. */
    private function aksiTidakDikenal(string $aksi): int
    {
        $this->error("Aksi \`{$aksi}\` tidak dikenal. Pakai: tambah atau hapus.");

        return self::FAILURE;
    }
}
