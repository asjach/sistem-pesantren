<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class RiwayatPotongRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Import bertahap: potongan baris JSON (maks 2000/panggilan). */
    public function rules(): array
    {
        return [
            'sesi_id' => ['nullable', 'integer', 'exists:import_sesi,id'],
            'mode' => ['required', 'in:periksa,eksekusi'],
            'total' => ['required_without:sesi_id', 'integer', 'min:1', 'max:600000'],
            'baris' => ['required', 'array', 'min:1', 'max:2000'],
            'baris.*' => ['array'],
            'terakhir' => ['sometimes', 'boolean'],
        ];
    }
}
