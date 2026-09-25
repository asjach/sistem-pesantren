<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Aturan bersama import bertahap (potongan JSON dari browser). Subkelas
 * menambah konteks fitur (mis. `gelombang_id` + `jenjang` untuk PSB).
 * Batas 1000 baris per panggilan disamakan batas Potongan pada frontend.
 */
abstract class PotongImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sesi_id' => ['nullable', 'integer', 'exists:import_sesi,id'],
            'mode' => ['required', 'in:periksa,eksekusi'],
            'total' => ['required_without:sesi_id', 'integer', 'min:1', 'max:600000'],
            'baris' => ['required', 'array', 'min:1', 'max:1000'],
            'baris.*' => ['array'],
            'terakhir' => ['sometimes', 'boolean'],
        ];
    }
}
