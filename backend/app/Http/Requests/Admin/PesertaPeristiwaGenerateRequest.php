<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PesertaPeristiwaGenerateRequest extends FormRequest
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
            'template' => ['required', 'string', 'max:200'],
            'mode_urutan' => ['required', 'in:per_tingkat,semua_tingkat'],
            'buat_ulang_otomatis' => ['sometimes', 'boolean'],
        ];
    }
}
