<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PesertaKegiatanEvaluatifUbahRequest extends FormRequest
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
            'nomor_peserta' => ['present', 'nullable', 'string', 'max:100'],
        ];
    }
}
