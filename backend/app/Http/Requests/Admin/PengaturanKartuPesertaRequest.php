<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PengaturanKartuPesertaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'desain_id' => ['nullable', 'integer', 'exists:desain_kartu_peserta,id'],
            'template_bawaan' => ['nullable', Rule::in(['klasik', 'modern', 'bersih'])],
            'lebar_mm' => ['required', 'numeric', 'min:40', 'max:150'],
            'tinggi_mm' => ['required', 'numeric', 'min:25', 'max:210'],
        ];
    }
}
