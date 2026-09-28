<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Urut daftar server-side: param `sort` (satu nilai / koma / array, maks 3
 * kunci) + `arah` (`naik`/`turun`, bawaan `naik`). Tiap nilai harus ada di
 * peta allowlist endpoint, sisanya 422. Tanpa sort = urutan bawaan lama.
 *
 * Arah per kolom: token boleh membawa sufiks `:naik`/`:turun` (juga ASC/DESC,
 * naik/turun polos) — mis. `sort=aktif:turun,nama`. Token berprefiks menang
 * atas param `arah` global.
 */
trait UrutDaftar
{
    /**
     * @param  array<string, string[]>  $peta  nilai => kolom ORDER BY berurutan.
     * @return array{kunci: string[], arah: array<string, 'naik'|'turun'>}|null
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
            ['sort' => array_map(fn ($v) => $this->tokenSortDasar($v), $daftar)],
            ['sort' => ['array', 'min:1', 'max:3'], 'sort.*' => [Rule::in(array_keys($peta))]]
        )->validate();

        $kunci = [];
        $arah = [];
        foreach ($daftar as $token) {
            [$nilai, $arahToken] = $this->uraiTokenSort($token);
            foreach ($peta[$nilai] as $kolom) {
                if (! in_array($kolom, $kunci, true)) {
                    $kunci[] = $kolom;
                    $arah[$kolom] = $arahToken ?? (string) $request->input('arah', 'naik');
                }
            }
        }

        return ['kunci' => $kunci, 'arah' => $arah];
    }

    /** Token tanpa sufiks arah — untuk validasi allowlist. */
    private function tokenSortDasar(string $token): string
    {
        return explode(':', $token, 2)[0];
    }

    /**
     * Urai token `kolom[:arah]` → [nilai, arah|null]. Sufiks dikenal:
     * `:naik`/`:asc` (naik) dan `:turun`/`:desc` (turun), tak peka huruf.
     *
     * @return array{0: string, 1: 'naik'|'turun'|null}
     */
    private function uraiTokenSort(string $token): array
    {
        if (! str_contains($token, ':')) {
            return [$token, null];
        }
        [$nilai, $sufiks] = explode(':', $token, 2);
        $s = strtolower(trim($sufiks));
        $arah = in_array($s, ['desc', 'turun'], true) ? 'turun' : (in_array($s, ['asc', 'naik'], true) ? 'naik' : null);

        return [$nilai, $arah];
    }

    /**
     * @param  array<int, array{0: string, 1: 'naik'|'turun'}>  $bawaan  urutan lama.
     * @param  string[]  $nullable  kolom boleh-NULL (selalu di bawah).
     * @param  array<string, 'naik'|'turun'>|null  $arah  arah per kolom (bila null: pakai `$urut['arah']` global).
     */
    protected function terapkanUrut(mixed $query, ?array $urut, array $bawaan, array $nullable = [], ?array $arah = null): void
    {
        $pasang = function (string $kolom, string $arahKolom) use ($query, $nullable): void {
            if (in_array($kolom, $nullable, true)) {
                $query->orderByRaw("{$kolom} IS NULL");
            }
            $query->{$arahKolom === 'naik' ? 'orderBy' : 'orderByDesc'}($kolom);
        };

        if ($urut === null) {
            foreach ($bawaan as [$kolom, $arahBawaan]) {
                $pasang($kolom, $arahBawaan);
            }

            return;
        }

        foreach ($urut['kunci'] as $kolom) {
            $arahKolom = $arah[$kolom] ?? $urut['arah'][$kolom] ?? 'naik';
            $pasang($kolom, $arahKolom);
        }
    }
}
