<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PsbPortalLanjutanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'santri_id' => ['required', 'integer', 'exists:santri,id'],
            'gelombang_id' => ['nullable', 'integer', 'exists:psb_gelombang,id'], // kosong = gelombang aktif
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
        ];
    }
}
