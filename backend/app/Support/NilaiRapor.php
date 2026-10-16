<?php

namespace App\Support;

/**
 * Fungsi murni modul Penilaian — dipisah agar murah diuji unit.
 *
 *  Semua aturan "mahal bila salah" (menyentuh ratusan rapor) tinggal di sini:
 *  nilai akhir = Σ skor×bobot, rata-rata, aturan predikat berjangkar KKM.
 */
class NilaiRapor
{
    /**
     * Nilai akhir = Σ (skor × bobot) / Σ bobot, hanya bila SEMUA komponen
     * berbobot terisi (keputusan terkunci PRD). Bila ada yang kosong →
     * `null` (belum bisa dihitung) + daftar komponen yang kurang.
     *
     * @param  array<int, float|null>  $skor  komponen_nilai_id => skor
     * @param  array<int, float>  $bobot  komponen_nilai_id => bobot
     * @return array{nilai: float|null, kurang: list<int>}
     */
    public static function nilaiAkhir(array $skor, array $bobot): array
    {
        $totalBobot = 0.0;
        $jumlah = 0.0;
        $kurang = [];

        foreach ($bobot as $komponenId => $b) {
            if ($b <= 0) {
                continue;
            }
            $totalBobot += $b;
            $s = $skor[$komponenId] ?? null;
            if ($s === null) {
                $kurang[] = (int) $komponenId;

                continue;
            }
            $jumlah += $s * $b;
        }

        if ($totalBobot <= 0 || $kurang !== []) {
            return ['nilai' => null, 'kurang' => $kurang];
        }

        return ['nilai' => round($jumlah / $totalBobot, 2), 'kurang' => []];
    }

    /**
     * Predikat berjangkar KKM `AKHIR`: pilih rentang dengan `offset_bawah`
     * TERBESAR yang masih terpenuhi (nilai ≥ KKM + offset). Rentang ber-offset
     * null = tanpa batas bawah (predikat terakhir, mis. D).
     *
     * @param  list<array{predikat: string, offset_bawah: float|null}>  $rentang
     */
    public static function predikat(float $nilai, float $kkm, array $rentang): ?string
    {
        $urut = $rentang;
        usort($urut, fn ($a, $b) => ($b['offset_bawah'] ?? -PHP_FLOAT_MAX) <=> ($a['offset_bawah'] ?? -PHP_FLOAT_MAX));

        foreach ($urut as $r) {
            if ($r['offset_bawah'] === null || $nilai >= $kkm + (float) $r['offset_bawah']) {
                return $r['predikat'];
            }
        }

        return null;
    }

    /** Rata-rata nilai (null diabaikan); null bila tak ada nilai. */
    public static function rataRata(array $nilai): ?float
    {
        $ada = array_values(array_filter($nilai, fn ($v) => $v !== null));
        if ($ada === []) {
            return null;
        }

        return round(array_sum($ada) / count($ada), 2);
    }

    /**
     * Peringkat per santri dari nilai akhir (urutan menurun; nilai sama =
     * peringkat sama, mengikuti pola "competition ranking").
     *
     * @param  array<int, float|null>  $nilaiPerSantri  santri_id => nilai
     * @return array<int, int> santri_id => peringkat
     */
    public static function peringkat(array $nilaiPerSantri): array
    {
        $urut = array_filter($nilaiPerSantri, fn ($v) => $v !== null);
        arsort($urut);

        $hasil = [];
        $posisi = 1;
        $sebelumnya = null;
        $samaSejak = 1;
        foreach ($urut as $santriId => $nilai) {
            if ($sebelumnya !== null && $nilai < $sebelumnya) {
                $posisi = $samaSejak;
            }
            $hasil[(int) $santriId] = $posisi;
            $samaSejak++;
            $sebelumnya = $nilai;
        }

        return $hasil;
    }
}
