<?php

namespace App\Services\Template;

use Dompdf\FontMetrics;

/**
 * Pengukur lebar teks untuk renderer HTML.
 *
 * dompdf tidak menyediakan cara memotong teks yang tidak muat, jadi ukuran
 * huruf harus dikecilkan lebih dulu. Pengukuran memakai FontMetrics milik
 * dompdf sendiri, sehingga angkanya identik dengan yang dipakai dompdf saat
 * merender. Estimasi dengan tabel lebar per karakter justru akan meleset,
 * karena glif Combining dan lebar kerning tidak ikut dihitung.
 *
 * Semua satuan keluar dalam milimeter agar sama dengan koordinat medan.
 */
class LebarHuruf
{
    private const MM_PER_PT = 25.4 / 72;

    /**
     * Sisa ruang yang dibiarkan kosong di tepi kotak, dalam persen.
     *
     * Dompdf memotong teks pada batas kotak persis. Bila lebar teks sama
     * dengan lebar kotak, huruf pertama dapat tergeser keluar kotaknya dan
     * terpotong. Menahan dua persen membuat teks yang nyaris penuh tetap
     * terbaca utuh.
     */
    private const MARGIN_SAFE = 0.98;

    public function __construct(private readonly FontMetrics $metrik) {}

    /**
     * Lebar teks dalam milimeter pada ukuran huruf tertentu.
     *
     * @param  float  $ukuran  ukuran huruf dalam point
     * @param  float  $spasi  jarak antarhuruf dalam point, sesuai gaya medan
     */
    public function lebar(string $teks, float $ukuran, string $font, float $spasi = 0.0): float
    {
        if ($teks === '') {
            return 0.0;
        }

        $lebarPt = $this->metrik->getTextWidth($teks, $font, $ukuran, 0.0, $spasi);

        return round($lebarPt * self::MM_PER_PT, 3);
    }

    /**
     * Berapa baris yang dibutuhkan teks setelah dilipat pada lebar tertentu.
     *
     * Dompdf melipat pada spasi dan tanda hubung, jadi pemecahan dilakukan di
     * tempat yang sama. Kata yang lebih panjang dari lebar kotak dipaksa satu
     * baris agar tidak terpotong di tengah.
     */
    public function jumlahBaris(string $teks, float $lebarMm, float $ukuran, string $font, float $spasi = 0.0): int
    {
        $teks = trim($teks);

        if ($teks === '' || $lebarMm <= 0.0) {
            return $teks === '' ? 0 : 1;
        }

        $baris = 1;
        $lebarBaris = 0.0;

        foreach (preg_split('/\s+/u', $teks) ?: [] as $kata) {
            if ($kata === '') {
                continue;
            }

            $lebarKata = $this->lebar($kata, $ukuran, $font, $spasi);
            $lebarSpasi = $this->lebar(' ', $ukuran, $font, $spasi);

            if ($lebarKata > $lebarMm) {
                // Kata tunggal lebih lebar dari kotak: dompdf memotongnya.
                $baris += substr_count($kata, '-');

                continue;
            }

            $tambahan = $lebarBaris === 0.0 ? $lebarKata : $lebarSpasi + $lebarKata;

            if ($lebarBaris + $tambahan > $lebarMm) {
                $baris++;
                $lebarBaris = $lebarKata;
            } else {
                $lebarBaris += $tambahan;
            }
        }

        return $baris;
    }

    /**
     * Potong teks agar muat satu baris, dengan elipsis bila terpotong.
     *
     * Dipakai untuk medan tanpa pembungkusan: lebih baik satu baris dengan
     * elipsis daripada meluber melewati kotak dan menimpa medan lain.
     */
    public function satuBaris(string $teks, float $lebarMm, float $ukuran, string $font, float $spasi = 0.0): string
    {
        $teks = trim(preg_replace('/\s+/u', ' ', $teks) ?? $teks);

        if ($teks === '' || $this->lebar($teks, $ukuran, $font, $spasi) <= $lebarMm) {
            return $teks;
        }

        $elipsis = '...';
        $lebarElipsis = $this->lebar($elipsis, $ukuran, $font, $spasi);

        if ($lebarElipsis > $lebarMm) {
            return '';
        }

        $batas = $lebarMm - $lebarElipsis;
        $hasil = '';

        foreach (mb_str_split($teks) as $huruf) {
            if ($this->lebar($hasil.$huruf, $ukuran, $font, $spasi) > $batas) {
                break;
            }

            $hasil .= $huruf;
        }

        return rtrim($hasil).$elipsis;
    }

    /**
     * Cari ukuran huruf terbesar yang masih muat di dalam kotak.
     *
     * Turun selangkah demi selangkah (0.5pt) seperti renderer PDF eksternal
     * supaya kedua mesin memilih ukuran yang sama untuk medan yang sama.
     * Nilai dikembalikan dalam point.
     *
     * @param  bool  $bungkus  true bila teks boleh dilipat ke beberapa baris
     */
    public function ukuranMuat(
        string $teks,
        float $lebarMm,
        float $tinggiMm,
        float $ukuran,
        float $hurufMin,
        string $font,
        float $spasi = 0.0,
        float $baris = 1.0,
        bool $bungkus = false,
    ): float {
        $ukuran = max($hurufMin, $ukuran);

        while ($ukuran > $hurufMin) {
            if ($this->muat($teks, $lebarMm, $tinggiMm, $ukuran, $font, $spasi, $baris, $bungkus)) {
                return round($ukuran, 2);
            }

            $ukuran = round($ukuran - 0.5, 2);
        }

        return round($hurufMin, 2);
    }

    private function muat(
        string $teks,
        float $lebarMm,
        float $tinggiMm,
        float $ukuran,
        string $font,
        float $spasi,
        float $baris,
        bool $bungkus,
    ): bool {
        $lebarBoleh = $lebarMm * self::MARGIN_SAFE;

        if (! $bungkus) {
            return $this->lebar($teks, $ukuran, $font, $spasi) <= $lebarBoleh;
        }

        $jumlah = $this->jumlahBaris($teks, $lebarBoleh, $ukuran, $font, $spasi);
        $tinggiBarisMm = $ukuran * $baris * self::MM_PER_PT;

        return $jumlah * $tinggiBarisMm <= $tinggiMm;
    }
}
