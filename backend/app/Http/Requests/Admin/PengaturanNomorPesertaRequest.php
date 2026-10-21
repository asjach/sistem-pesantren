<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PengaturanNomorPesertaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'kegiatan_evaluatif_id' => ['required', 'integer', 'exists:kegiatan_evaluatif,id'],
            'semester' => ['required', 'in:1,2'],
            'template' => ['required', 'string', 'max:200'],
            'mode_urutan' => ['required', 'in:per_tingkat,semua_tingkat'],
        ];
    }
}
