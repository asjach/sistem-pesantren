<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PsbDokumenIndexWajibRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'psb_kegiatan_id' => ['required', 'integer', 'exists:psb_kegiatan,id'],
            'jenjang' => ['sometimes', 'string', 'exists:lembaga,jenjang'],
        ];
    }
}
