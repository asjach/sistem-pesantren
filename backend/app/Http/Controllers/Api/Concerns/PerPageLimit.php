<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\Request;

/**
 * Batas baris per halaman untuk endpoint daftar.
 * Pilihan "Semua" di FE dikirim sebagai `per_page=0` (atau `all`) dan berarti
 * seluruh baris ikut dalam satu halaman.
 */
trait PerPageLimit
{
    /** Batas praktis "Semua baris": cukup besar untuk satu pesantren, tanpa LIMIT tak terhingga. */
    protected const PER_PAGE_ALL = 100000;

    /** Bawaan bila klien tidak mengirim `per_page`. */
    protected const PER_PAGE_DEFAULT = 100;

    protected function perPage(Request $request): int
    {
        $raw = $request->input('per_page');

        if ($raw === null) {
            return self::PER_PAGE_DEFAULT;
        }

        if (is_string($raw) && strtolower($raw) === 'all') {
            return self::PER_PAGE_ALL;
        }

        if ((int) $raw <= 0) {
            return self::PER_PAGE_ALL;
        }

        return max(1, min((int) $raw, 1000));
    }
}
