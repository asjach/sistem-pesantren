<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PesertaPeristiwaUbahRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'semester' => ['required', 'in:1,2'],
            'nomor_peserta' => ['present', 'nullable', 'string', 'max:100'],
        ];
    }
}
