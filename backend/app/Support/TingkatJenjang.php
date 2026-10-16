<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Tingkat akhir & tingkat sebelumnya per jenjang — sumbernya `ref_tingkat`
 * (`urutan` tertinggi = tingkat akhir; MI 6, MTS 9, MLN 12, MD 6).
 *
 *  Dipakai peristiwa penilaian: ASAT berlaku "semua kecuali tingkat akhir",
 *  UJIAN/UAP hanya tingkat akhir, dan komponen "rata-rata rapor N tingkat
 *  sebelumnya" pada UJIAN.
 *
 *  Sengaja TANPA cache statis: `ref_tingkat` kecil dan cache statis bocor
 *  antar-test (RefreshDatabase).
 */
class TingkatJenjang
{
    /** Tingkat akhir jenjang (nama tingkat ber-`urutan` tertinggi), null bila jenjang tanpa tingkat. */
    public static function akhir(string $jenjang): ?string
    {
        $nama = DB::table('ref_tingkat')
            ->where('jenjang', $jenjang)
            ->where('is_active', true)
            ->orderByDesc('urutan')
            ->orderByDesc('nama')
            ->value('nama');

        return $nama === null ? null : (string) $nama;
    }

    /** Apakah `$tingkat` adalah tingkat akhir jenjang itu. */
    public static function adalahAkhir(string $jenjang, ?string $tingkat): bool
    {
        $akhir = self::akhir($jenjang);

        return $akhir !== null && $tingkat !== null && (string) $tingkat === $akhir;
    }

    /**
     * N tingkat TEPAT sebelum `$tingkat` (urut `urutan`), untuk rata-rata
     * rapor. Contoh: tingkat 9 MTS, n=2 → ['7', '8'].
     *
     * @return list<string>
     */
    public static function sebelumnya(string $jenjang, ?string $tingkat, int $n): array
    {
        if ($tingkat === null || $n < 1) {
            return [];
        }
        $daftar = DB::table('ref_tingkat')
            ->where('jenjang', $jenjang)
            ->where('is_active', true)
            ->orderBy('urutan')
            ->pluck('nama')
            ->map(fn ($v) => (string) $v)
            ->all();

        $idx = array_search((string) $tingkat, $daftar, true);
        if ($idx === false || $idx === 0) {
            return [];
        }

        return array_slice($daftar, max(0, $idx - $n), $idx - max(0, $idx - $n));
    }
}
