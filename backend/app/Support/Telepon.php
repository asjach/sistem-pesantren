<?php

namespace App\Support;

/**
 * Normalisasi nomor telepon Indonesia ke bentuk kanonik `62...` (digit saja).
 *
 * Abaikan spasi, strip, titik, kurung, plus, dan kode negara — sehingga
 * `0812-3456-7890`, `+62 812 3456 7890`, dan `6281234567890` semuanya
 * menjadi `6281234567890`. Dipakai pembuatan akun (penyimpanan + cek
 * bentrok) dan pencocokan identifier saat login.
 */
class Telepon
{
    /**
     * Normalkan nomor telepon → digit kanonik `62...`.
     * Kosong / mengandung huruf / panjang tak wajar → null.
     */
    public static function normalisasi(mixed $nilai): ?string
    {
        $teks = trim((string) $nilai);
        if ($teks === '') {
            return null;
        }
        if (preg_match('/[a-zA-Z]/', $teks)) {
            return null;
        }
        $digit = (string) preg_replace('/\D/', '', $teks);
        if ($digit === '') {
            return null;
        }

        if (str_starts_with($digit, '62')) {
            $normal = $digit;
        } elseif (str_starts_with($digit, '0')) {
            $normal = '62'.substr($digit, 1);
        } else {
            $normal = '62'.$digit;
        }

        $panjang = strlen($normal);
        if ($panjang < 10 || $panjang > 16) {
            return null;
        }

        return $normal;
    }

    /**
     * Varian penulisan yang dianggap nomor sama (untuk cek bentrok terhadap
     * data lama yang tersimpan mentah): kanonik + bentuk `08...`.
     *
     * @return list<string>
     */
    public static function varian(string $normal): array
    {
        return array_values(array_unique([$normal, '0'.substr($normal, 2)]));
    }
}
