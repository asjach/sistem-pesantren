<?php

namespace App\Services;

use App\Models\LabelKolom;
use Illuminate\Support\Facades\Cache;

/**
 * Kamus kolom level tabel database (global se-pesantren): nama header,
 * perataan, lebar, tooltip, format, dan kontrol urut per kolom.
 * Dibaca lintas halaman; invalidasi via versi global (pola RefService).
 */
class KamusKolomService
{
    public const VERSI_KEY = 'kamus_kolom:versi';

    public static function versi(): int
    {
        return (int) Cache::get(self::VERSI_KEY, 1);
    }

    public static function bump(): void
    {
        Cache::put(self::VERSI_KEY, self::versi() + 1);
    }

    /**
     * Peta kolom untuk daftar tabel: "tabel.kolom" => atribut kamus.
     *
     * @param  string[]  $tabel
     * @return array<string, array<string, mixed>>
     */
    public static function peta(array $tabel): array
    {
        $tabel = array_values(array_unique(array_filter(array_map(
            fn ($t) => trim((string) $t),
            $tabel,
        ))));
        if ($tabel === []) {
            return [];
        }
        sort($tabel);
        $kunci = 'kamus_kolom:peta:'.md5(implode(',', $tabel)).':v'.self::versi();

        return Cache::remember($kunci, 600, function () use ($tabel) {
            $peta = [];
            foreach (LabelKolom::whereIn('tabel', $tabel)->get() as $row) {
                $peta[$row->tabel.'.'.$row->kolom] = [
                    'label' => $row->label,
                    'align' => $row->align,
                    'lebar' => $row->lebar,
                    'kunci_lebar' => $row->kunci_lebar,
                    'bisa_urut' => $row->bisa_urut,
                    'arah_bawaan' => $row->arah_bawaan,
                    'tooltip' => $row->tooltip,
                    'format' => $row->format,
                ];
            }

            return $peta;
        });
    }
}
