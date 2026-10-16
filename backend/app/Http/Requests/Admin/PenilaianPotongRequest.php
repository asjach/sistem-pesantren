<?php

namespace App\Http\Requests\Admin;

/**
 * Import bertahap modul Penilaian — menambah konteks tetap sesi (tipe template,
 * TA, semester, komponen target) di atas aturan bersama `PotongImportRequest`.
 */
class PenilaianPotongRequest extends PotongImportRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return parent::rules() + [
            'tipe' => ['required', 'in:nilai,catatan_wali,prestasi,ekskul'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'semester' => ['required', 'in:1,2'],
            // Lingkup jenjang yang diizinkan (kosong = seluruh akses pengguna).
            'jenjang' => ['nullable', 'array'],
            'jenjang.*' => ['string', 'exists:lembaga,jenjang'],
            'komponen_id' => ['nullable', 'integer', 'exists:komponen_nilai,id'],
        ];
    }
}
