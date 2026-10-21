<?php

namespace App\Http\Requests\Admin;

use App\Http\Controllers\Api\Concerns\FilterGlobal;
use Illuminate\Foundation\Http\FormRequest;

class PesertaKegiatanEvaluatifIndexRequest extends FormRequest
{
    use FilterGlobal;

    protected function prepareForValidation(): void
    {
        $this->merge($this->normalisasiFilterInputs(['kelas_id', 'tingkat']));
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'kegiatan_evaluatif_id' => ['required', 'integer', 'exists:kegiatan_evaluatif,id'],
            'semester' => ['required', 'in:1,2'],
            'kelas_id' => ['nullable', 'array'],
            'kelas_id.*' => ['integer', 'exists:kelas,id'],
            'tingkat' => ['nullable', 'array'],
            'tingkat.*' => ['string', 'max:30'],
            'q' => ['nullable', 'string', 'max:100'],
        ];
    }
}
