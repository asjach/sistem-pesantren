<?php

namespace App\Console\Commands;

use App\Services\PapanService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use InvalidArgumentException;

#[Signature('papan:butir
    {aksi : tambah | hapus | ubah | naik | turun}
    {kode : Kode sub-modul, mis. E.3}
    {--id= : Id butir (wajib untuk hapus, ubah, naik, turun)}
    {--status= : Status butir: sudah | sedang | akan | ditunda}
    {--deskripsi= : Isi butir (wajib untuk tambah, opsional untuk ubah)}
    {--catatan= : Alasan singkat bila status ikut berubah}
    {--oleh=agent : Pencatat: agent atau pengguna}')]
#[Description('Tambah, ubah, geser, atau hapus butir di bawah sebuah sub-modul papan.')]
class PapanButir extends Command
{
    /** Jalankan aksi pada butir papan. */
    public function handle(PapanService $papan): int
    {
        $aksi = (string) $this->argument('aksi');
        $kode = (string) $this->argument('kode');

        try {
            return match ($aksi) {
                'tambah' => $this->tambah($papan, $kode),
                'ubah' => $this->ubah($papan, $kode),
                'naik' => $this->geser($papan, $kode, -1),
                'turun' => $this->geser($papan, $kode, 1),
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

        $status = (string) ($this->option('status') ?: 'akan');
        $butir = $papan->tambahButir($kode, $status, trim($deskripsi));

        $this->info("Butir #{$butir->id} ditambahkan ke {$kode} [{$butir->status}].");

        return self::SUCCESS;
    }

    /**
     * Ubah teks dan/atau status sebuah butir.
     *
     * Hanya yang benar-benar disebut pengguna yang dikirim: tanpa --deskripsi
     * teksnya dibiarkan, tanpa --status statusnya dibiarkan. Opsi status di
     * sini sengaja TIDAK punya nilai bawaan, supaya "tidak disebut" bisa
     * dibedakan dari "disebut bernilai sedang".
     */
    private function ubah(PapanService $papan, string $kode): int
    {
        $id = $this->option('id');

        if (! is_numeric($id)) {
            $this->error('Opsi --id wajib diisi (angka) untuk aksi ubah.');

            return self::FAILURE;
        }

        $deskripsi = trim((string) $this->option('deskripsi'));
        $status = $this->option('status');

        if ($deskripsi === '' && $status === null) {
            $this->error('Isi --deskripsi dan/atau --status untuk aksi ubah.');

            return self::FAILURE;
        }

        $butir = $papan->ubahButir(
            $kode,
            (int) $id,
            $deskripsi === '' ? null : $deskripsi,
            $status === null ? null : (string) $status,
            (string) ($this->option('oleh') ?: 'agent'),
            $this->option('catatan') === null ? null : (string) $this->option('catatan'),
        );

        $this->info("Butir #{$butir->id} diperbarui [{$butir->status}].");

        return self::SUCCESS;
    }

    /** Geser butir naik (-1) atau turun (1) satu langkah. */
    private function geser(PapanService $papan, string $kode, int $arah): int
    {
        $id = $this->option('id');

        if (! is_numeric($id)) {
            $this->error('Opsi --id wajib diisi (angka) untuk aksi ini.');

            return self::FAILURE;
        }

        if (! $papan->geserButir($kode, (int) $id, $arah)) {
            $this->error("Butir #{$id} sudah di ujung urutan (atau tidak ditemukan).");

            return self::FAILURE;
        }

        $arahTeks = $arah === -1 ? 'naik' : 'turun';
        $this->info("Butir #{$id} digeser {$arahTeks}.");

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

    /** Aksi di luar daftar yang dikenal. */
    private function aksiTidakDikenal(string $aksi): int
    {
        $this->error("Aksi `{$aksi}` tidak dikenal. Pakai: tambah, ubah, naik, turun, atau hapus.");

        return self::FAILURE;
    }
}
