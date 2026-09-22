<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PsbImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'gelombang_id' => ['required', 'integer', 'exists:psb_gelombang,id'],
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
        ];
    }
}
