<?php

if (! function_exists('terbilang')) {
    function terbilang($angka)
    {
        $angka = abs($angka);
        $baca = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
        $terbilang = '';

        if ($angka < 12) {
            $terbilang = ' ' . $baca[(int) $angka];
        } elseif ($angka < 20) {
            $terbilang = terbilang((int) $angka - 10) . ' Belas';
        } elseif ($angka < 100) {
            $terbilang = terbilang((int) ($angka / 10)) . ' Puluh' . terbilang((int) $angka % 10);
        } elseif ($angka < 200) {
            $terbilang = ' Seratus' . terbilang((int) $angka - 100);
        } elseif ($angka < 1000) {
            $terbilang = terbilang((int) ($angka / 100)) . ' Ratus' . terbilang((int) $angka % 100);
        } elseif ($angka < 2000) {
            $terbilang = ' Seribu' . terbilang((int) $angka - 1000);
        } elseif ($angka < 1000000) {
            $terbilang = terbilang((int) ($angka / 1000)) . ' Ribu' . terbilang((int) $angka % 1000);
        } elseif ($angka < 1000000000) {
            $terbilang = terbilang((int) ($angka / 1000000)) . ' Juta' . terbilang((int) $angka % 1000000);
        }

        return trim($terbilang);
    }
}
