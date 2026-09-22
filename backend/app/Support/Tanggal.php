<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Shared\Date;

/** Bantuan tanggal untuk impor Excel/CSV. */
class Tanggal
{
    /**
     * Tanggal nol khas ekspor Excel/sistem lama (`1900-01-00`, bulan/hari `00`)
     * artinya KOSONG — bukan tanggal valid.
     */
    public static function adalahTanggalNol(mixed $nilai): bool
    {
        if (! is_string($nilai)) {
            return false;
        }
        $teks = trim($nilai);

        return (bool) preg_match('/^\d{4}-00-\d{2}$|^\d{4}-\d{2}-00$|^0000-\d{2}-\d{2}$/', $teks);
    }

    /**
     * Terima serial Excel (angka) atau teks tanggal → 'Y-m-d'.
     * Kosong / tanggal nol / tidak bisa diparse → null.
     */
    public static function parse(mixed $nilai): ?string
    {
        if (empty($nilai)) {
            return null;
        }

        if (self::adalahTanggalNol($nilai)) {
            return null;
        }

        if (is_numeric($nilai)) {
            return Date::excelToDateTimeObject($nilai)->format('Y-m-d');
        }

        try {
            return Carbon::parse($nilai)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }
}
