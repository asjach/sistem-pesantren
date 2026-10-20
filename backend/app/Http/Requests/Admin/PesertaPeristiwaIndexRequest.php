<?php

namespace App\Http\Requests\Admin;

use App\Http\Controllers\Api\Concerns\FilterGlobal;
use Illuminate\Foundation\Http\FormRequest;

class PesertaPeristiwaIndexRequest extends FormRequest
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
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'semester' => ['required', 'in:1,2'],
            'kelas_id' => ['nullable', 'array'],
            'kelas_id.*' => ['integer', 'exists:kelas,id'],
            'tingkat' => ['nullable', 'array'],
            'tingkat.*' => ['string', 'max:30'],
            'q' => ['nullable', 'string', 'max:100'],
        ];
    }
}
