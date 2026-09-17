<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Urut daftar server-side: param `sort` (satu nilai / koma / array, maks 3
 * kunci) + `arah` (`naik`/`turun`, bawaan `naik`). Tiap nilai harus ada di
 * peta allowlist endpoint, sisanya 422. Tanpa sort = urutan bawaan lama.
 */
trait UrutDaftar
{
    /**
     * @param  array<string, string[]>  $peta  nilai => kolom ORDER BY berurutan.
     * @return array{kunci: string[], arah: 'naik'|'turun'}|null
     */
    protected function parseUrut(Request $request, array $peta): ?array
    {
        $mentah = $request->input('sort');
        if ($mentah === null || $mentah === '' || $mentah === []) {
            return null;
        }
        $daftar = is_array($mentah) ? $mentah : explode(',', (string) $mentah);
        $daftar = array_values(array_filter(array_map(fn ($v) => trim((string) $v), $daftar)));
        if ($daftar === []) {
            return null;
        }

        $request->validate(['arah' => ['nullable', Rule::in(['naik', 'turun'])]]);

        validator(
            ['sort' => $daftar],
            ['sort' => ['array', 'min:1', 'max:3'], 'sort.*' => [Rule::in(array_keys($peta))]]
        )->validate();

        $kunci = [];
        foreach ($daftar as $nilai) {
            foreach ($peta[$nilai] as $kolom) {
                if (! in_array($kolom, $kunci, true)) {
                    $kunci[] = $kolom;
                }
            }
        }

        /** @var 'naik'|'turun' $arah */
        $arah = $request->input('arah', 'naik');

        return ['kunci' => $kunci, 'arah' => $arah];
    }

    /**
     * @param  array<int, array{0: string, 1: 'naik'|'turun'}>  $bawaan  urutan lama.
     * @param  string[]  $nullable  kolom boleh-NULL (selalu di bawah).
     */
    protected function terapkanUrut(mixed $query, ?array $urut, array $bawaan, array $nullable = []): void
    {
        $pasang = function (string $kolom, string $arah) use ($query, $nullable): void {
            if (in_array($kolom, $nullable, true)) {
                $query->orderByRaw("{$kolom} IS NULL");
            }
            $query->{$arah === 'naik' ? 'orderBy' : 'orderByDesc'}($kolom);
        };

        if ($urut === null) {
            foreach ($bawaan as [$kolom, $arah]) {
                $pasang($kolom, $arah);
            }

            return;
        }

        foreach ($urut['kunci'] as $kolom) {
            $pasang($kolom, $urut['arah']);
        }
    }
}
