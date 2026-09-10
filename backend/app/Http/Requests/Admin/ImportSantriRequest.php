<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ImportSantriRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tahun_ajaran_id' => ['required', 'exists:tahun_ajaran,id'],
            'lembaga_id'      => ['nullable', 'exists:lembaga,id'],   // hanya dipakai admin full
            'file'            => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ];
    }
}
