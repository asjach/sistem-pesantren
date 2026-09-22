<?php

namespace App\Support;

/**
 * Penanda NIK/no.KK tak valid: nilai yang digitnya bukan 16 disimpan dengan
 * awalan `X-` agar ketahuan tak valid (`X-320410460905001`). Idempoten:
 * nilai valid dan yang sudah berawalan `X-` tidak diubah.
 */
class NikFlag
{
    public const TANDA = 'X-';

    public static function tandai(mixed $nilai): mixed
    {
        if ($nilai === null || (! is_string($nilai) && ! is_int($nilai) && ! is_float($nilai))) {
            return $nilai;
        }
        $teks = trim((string) $nilai);
        if ($teks === '' || preg_match('/^\d{16}$/', $teks) || str_starts_with($teks, self::TANDA)) {
            return $teks === '' ? $nilai : $teks;
        }

        return self::TANDA.$teks;
    }

    public static function valid(mixed $nilai): bool
    {
        return is_string($nilai) && (bool) preg_match('/^\d{16}$/', trim($nilai));
    }
}
