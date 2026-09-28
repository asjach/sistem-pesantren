<?php

namespace App\Services\Template;

use RuntimeException;
use Throwable;

/**
 * Berkas template PDF tidak bisa dipakai: rusak, bukan PDF, hilang, atau
 * kosong. Pesannya berbahasa Indonesia supaya bisa langsung tampil di
 * formulir tanpa diterjemahkan ulang.
 */
class TemplatePdfTidakValidException extends RuntimeException
{
    public static function dariPustaka(Throwable $sebab): self
    {
        return new self('Berkas template PDF tidak dapat dibaca. Pastikan berkas bukan rusak dan tidak diproteksi kata sandi.', 0, $sebab);
    }

    public static function berkasKosong(): self
    {
        return new self('Template ini belum memiliki berkas PDF. Unggah berkas template terlebih dahulu.');
    }

    public static function berkasHilang(string $path): self
    {
        return new self('Berkas template tidak ditemukan di penyimpanan ('.$path.'). Silakan unggah ulang.');
    }
}
