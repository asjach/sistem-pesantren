<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\Request;

trait FilterGlobal
{
    protected function nilaiFilter(Request $request, string $key): array
    {
        $raw = $request->input($key);
        if ($raw === null) {
            $raw = $request->input($key.'[]');
        }
        if (! is_array($raw)) {
            $raw = [$raw];
        }

        $values = [];
        foreach ($raw as $value) {
            if (is_array($value) || is_object($value)) {
                continue;
            }
            $value = trim((string) $value);
            if ($value !== '' && ! in_array($value, $values, true)) {
                $values[] = $value;
            }
        }

        return $values;
    }

    protected function normalisasiFilterInput(string $key): ?array
    {
        $input = $this->all();
        if (! array_key_exists($key, $input) && ! array_key_exists($key.'[]', $input)) {
            return null;
        }

        return $this->nilaiFilter($this, $key);
    }

    protected function normalisasiFilterInputs(array $keys): array
    {
        $normalized = [];
        foreach ($keys as $key) {
            $value = $this->normalisasiFilterInput($key);
            if ($value !== null) {
                $normalized[$key] = $value;
            }
        }

        return $normalized;
    }

    protected function applyFilter(mixed $query, Request $request, string $key, string $column, bool $integer = false): void
    {
        $values = $this->nilaiFilter($request, $key);
        if ($integer) {
            $values = array_values(array_unique(array_map(static fn (string $value): int => (int) $value, $values)));
        }
        if ($values !== []) {
            $query->whereIn($column, $values);
        }
    }

    protected function applyAcademicFilters(mixed $query, Request $request, string $prefix = 'riwayat_belajar.'): void
    {
        $this->applyFilter($query, $request, 'tahun_ajaran', $prefix.'tahun_ajaran');
        $this->applyFilter($query, $request, 'semester', $prefix.'semester');
        $this->applyFilter($query, $request, 'tingkat', $prefix.'tingkat');
        $this->applyFilter($query, $request, 'kelas_id', $prefix.'kelas_id', true);
    }

    protected function hasAcademicFilter(Request $request): bool
    {
        foreach (['tahun_ajaran', 'semester', 'tingkat', 'kelas_id'] as $key) {
            if ($this->nilaiFilter($request, $key) !== []) {
                return true;
            }
        }

        return false;
    }
}
