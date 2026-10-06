<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * Aturan jatuh tempo tagihan.
 *
 * Jenis bulanan: jatuh tempo tetap tanggal 10 pada bulan SESUDAH periode tagihan
 * (tagihan periode 2025-07 → jatuh tempo 2025-08-10). Jadi tagihan baru
 * dianggap TUNGGAKAN setelah tanggal 10 itu lewat.
 *
 * Jenis non-bulanan: jatuh tempo diisi manual per tagihan (boleh kosong).
 */
class JatuhTempo
{
    /** Tanggal jatuh tempo tagihan bulanan (tanggal 10 bulan berikutnya). */
    public const HARI_BULANAN = 10;

    /**
     * Jatuh tempo tagihan bulanan dari periodenya ('YYYY-MM') → 'Y-m-d'.
     * Periode kosong/tidak berbentuk YYYY-MM → null (tidak bisa dihitung).
     */
    public static function bulanan(?string $periode): ?string
    {
        if (! is_string($periode) || ! preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', trim($periode), $m)) {
            return null;
        }

        return Carbon::createFromFormat('Y-m-d', $m[1].'-'.$m[2].'-01')
            ->addMonthNoOverflow()
            ->day(self::HARI_BULANAN)
            ->toDateString();
    }

    /**
     * Jatuh tempo efektif sebuah tagihan.
     *
     * @param  string  $tipe  'bulanan' | 'non_bulanan'
     * @param  string|null  $periode  Periode tagihan bulanan ('YYYY-MM').
     * @param  string|null  $manual  Jatuh tempo hasil input (dipakai jenis non-bulanan).
     */
    public static function untuk(string $tipe, ?string $periode, ?string $manual = null): ?string
    {
        if ($tipe === 'bulanan') {
            return self::bulanan($periode);
        }

        return $manual !== null && $manual !== '' ? $manual : null;
    }
}
