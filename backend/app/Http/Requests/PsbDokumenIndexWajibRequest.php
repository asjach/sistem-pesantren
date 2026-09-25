<?php

namespace App\Http\Requests;

use App\Http\Controllers\Api\Concerns\FilterGlobal;
use Illuminate\Foundation\Http\FormRequest;

class PsbDokumenIndexWajibRequest extends FormRequest
{
    use FilterGlobal;

    protected function prepareForValidation(): void
    {
        $this->merge($this->normalisasiFilterInputs(['jenjang']));
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'psb_kegiatan_id' => ['required', 'integer', 'exists:psb_kegiatan,id'],
            'jenjang' => ['sometimes', 'array'],
            'jenjang.*' => ['string', 'exists:lembaga,jenjang'],
        ];
    }
}
