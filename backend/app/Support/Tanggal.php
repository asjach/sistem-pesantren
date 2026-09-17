<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Shared\Date;

/** Bantuan tanggal untuk impor Excel/CSV. */
class Tanggal
{
    /**
     * Terima serial Excel (angka) atau teks tanggal → 'Y-m-d'.
     * Kosong / tidak bisa diparse → null.
     */
    public static function parse(mixed $nilai): ?string
    {
        if (empty($nilai)) {
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
