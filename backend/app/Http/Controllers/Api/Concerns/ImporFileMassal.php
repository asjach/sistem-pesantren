<?php

namespace App\Http\Controllers\Api\Concerns;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Alur import file Excel massal (satu panggilan, bukan potongan JSON):
 * mode `periksa` = dry-run (transaksi selalu di-rollback), mode eksekusi
 * menulis; galat Maatwebsite (`Failure[]`) diformat seragam ke array
 * `{row, attribute, errors}`.
 *
 * Dipakai berdampingan dengan trait ImporBertahap (potongan JSON dari
 * browser) oleh controller yang punya dua jalur import.
 */
trait ImporFileMassal
{
    /**
     * Jalankan import file dengan pembungkus dry-run/eksekusi.
     *
     * @param  Request  $request  request import (dengan berkas `file`)
     * @param  object  $import  pembungkus Maatwebsite (punya `ringkasan()` + `failures()`)
     * @param  bool  $periksa  true = dry-run (transaksi di-rollback, tidak menulis)
     * @param  Closure(array): string  $pesanSukses  pesan eksekusi sukses dari ringkasan
     * @param  Closure|null  $sebelum  hook opsional sebelum import (mis. authorize + ini_set)
     */
    protected function imporFile(Request $request, object $import, bool $periksa, Closure $pesanSukses, ?Closure $sebelum = null): JsonResponse
    {
        if ($sebelum !== null) {
            $sebelum();
        }

        $request->validated();

        $errors = [];

        if ($periksa) {
            DB::beginTransaction();
        }

        try {
            Excel::import($import, $request->file('file'));
        } catch (ValidationException $e) {
            $errors = $this->formatFailures($e->failures());
        } finally {
            if ($periksa) {
                DB::rollBack();
            }
        }

        if ($errors === []) {
            $errors = $this->formatFailures($import->failures());
        }

        if ($periksa) {
            return response()->json([
                'pesan' => $errors === [] ? 'Pengecekan selesai: file siap diimport.' : 'Pengecekan menemukan masalah.',
                'siap_import' => $errors === [],
                'ringkasan' => $import->ringkasan(),
                'errors' => $errors,
            ]);
        }

        if ($errors !== []) {
            return response()->json([
                'pesan' => 'Gagal mengimport beberapa data.',
                'errors' => $errors,
            ], 422);
        }

        $ringkasan = $import->ringkasan();

        return response()->json([
            'pesan' => $pesanSukses($ringkasan),
            'ringkasan' => $ringkasan,
        ]);
    }

    /** Format galat Maatwebsite (`Failure[]`) untuk respons JSON. */
    protected function formatFailures(iterable $failures): array
    {
        $errors = [];
        foreach ($failures as $failure) {
            $errors[] = [
                'row' => $failure->row(),
                'attribute' => $failure->attribute(),
                'errors' => $failure->errors(),
            ];
        }

        return $errors;
    }
}
