<?php

namespace App\Support;

/**
 * Terbilang khusus RAPOR — BUKAN ejaan baku.
 *
 *  Rapor MI/MD menulis nilai akhir per-digit kata: `96` → "sembilan enam",
 *  `86,67` → "delapan enam koma enam tujuh" (lihat spesimen rapor). Helper
 *  `terbilang()` baku yang sudah ada ("Seratus dua puluh") TIDAK dipakai di
 *  sini karena formatnya berbeda.
 *
 *  Juga menyediakan `ordinal()` untuk kolom Peringkat ("1 → pertama",
 *  "6 → keenam"), yang juga tidak ada padanannya di helper baku.
 */
class Terbilang
{
    private const DIGIT = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];

    private const BELASAN = [
        10 => 'sepuluh', 11 => 'sebelas', 12 => 'dua belas', 13 => 'tiga belas',
        14 => 'empat belas', 15 => 'lima belas', 16 => 'enam belas', 17 => 'tujuh belas',
        18 => 'delapan belas', 19 => 'sembilan belas',
    ];

    /**
     * Eja per-digit. Koma dibaca "koma"; pemisah ribuan titik DIABAIKAN
     * (rapor memakai angka tanpa pemisah ribuan).
     */
    public static function perDigit(int|float|string|null $nilai): string
    {
        if ($nilai === null || $nilai === '') {
            return '';
        }

        // Normalisasi: koma sebagai desimal (locale id-ID), titik ribuan dibuang.
        $teks = is_string($nilai) ? trim($nilai) : rtrim(rtrim(number_format((float) $nilai, 2, ',', ''), '0'), ',');
        $teks = str_replace('.', '', $teks);

        $kata = [];
        foreach (str_split($teks) as $ch) {
            if ($ch === ',') {
                $kata[] = 'koma';
            } elseif (ctype_digit($ch)) {
                $kata[] = self::DIGIT[(int) $ch];
            }
            // Tanda lain (-, spasi, dsb.) diabaikan.
        }

        return implode(' ', $kata);
    }

    /** Ordinal peringkat: 1 → "pertama", 6 → "keenam", 21 → "kedua puluh satu". */
    public static function ordinal(int $n): string
    {
        if ($n <= 0) {
            return '';
        }
        if ($n === 1) {
            return 'pertama';
        }

        return 'ke'.self::kataDasar($n);
    }

    /** Kata dasar bilangan (tanpa awalan `ke`), dibatasi 0–999 (cukup peringkat kelas). */
    public static function kataDasar(int $n): string
    {
        if ($n < 0) {
            return 'minus '.self::kataDasar(-$n);
        }
        if ($n < 10) {
            return self::DIGIT[$n];
        }
        if (isset(self::BELASAN[$n])) {
            return self::BELASAN[$n];
        }
        if ($n < 100) {
            $puluh = intdiv($n, 10);
            $sisa = $n % 10;

            return self::DIGIT[$puluh].' puluh'.($sisa > 0 ? ' '.self::DIGIT[$sisa] : '');
        }
        if ($n < 200) {
            $sisa = $n - 100;

            return 'seratus'.($sisa > 0 ? ' '.self::kataDasar($sisa) : '');
        }
        if ($n < 1000) {
            $ratus = intdiv($n, 100);
            $sisa = $n % 100;

            return self::DIGIT[$ratus].' ratus'.($sisa > 0 ? ' '.self::kataDasar($sisa) : '');
        }

        return (string) $n;
    }
}
