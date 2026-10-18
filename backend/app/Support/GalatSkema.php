<?php

namespace App\Support;

use Illuminate\Database\QueryException;

/**
 * Pengenal galat "skema database tertinggal".
 *
 * Gejalanya khas: kode baru sudah memakai kolom/tabel yang migrasinya belum
 * dijalankan di server (mis. `Unknown column 'info_html' in 'field list'`).
 * Tanpa pengaman ini jawaban server membawa pesan SQL mentah — di mode debug
 * lengkap dengan nama tabel, kolom, dan nilai binding — lalu toast aplikasi
 * menampilkannya apa adanya. Pengguna tak bisa berbuat apa-apa dengan teks
 * itu, dan nilainya bisa memuat data pribadi.
 *
 * Yang dikenali HANYA SQLSTATE ketidakcocokan skema. Galat query lain
 * (constraint, sintaks, koneksi) dibiarkan ke penanganan bawaan supaya tidak
 * tertutup pesan yang menyesatkan.
 *
 * @see HtmlInfo
 */
final class GalatSkema
{
    /** Penanda mesin bagi klien; pesan manusianya ada di `PESAN`. */
    public const KODE = 'skema_tertinggal';

    /** Pesan siap tampil. Sengaja menyebut perintah yang harus dijalankan. */
    public const PESAN = 'Database di server belum diperbarui: kemungkinan ada migrasi yang belum dijalankan. Minta admin server menjalankan "php artisan migrate", lalu coba lagi.';

    /**
     * SQLSTATE yang berarti objek skema tak cocok dengan kode:
     *  - 42S22 kolom tidak ada,
     *  - 42S02 tabel/view tidak ada,
     *  - 42S21 kolom sudah ada (migrasi terhenti di tengah).
     *
     * @var list<string>
     */
    private const SQLSTATE = ['42S22', '42S02', '42S21'];

    /** Pesan untuk pengguna, atau `null` bila bukan galat skema. */
    public static function pesan(QueryException $e): ?string
    {
        return self::kode($e) === null ? null : self::PESAN;
    }

    /** SQLSTATE galat skema (mis. '42S22'), atau `null` bila bukan galat skema. */
    public static function kode(QueryException $e): ?string
    {
        $info = $e->errorInfo;
        $kode = is_array($info) && isset($info[0]) && is_string($info[0])
            ? $info[0]
            : (string) $e->getCode();

        $kode = strtoupper(trim($kode));

        return in_array($kode, self::SQLSTATE, true) ? $kode : null;
    }
}
