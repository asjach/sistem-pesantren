<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class KelasImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Import file kelas multi-lembaga/TA: lingkup ada per baris, request hanya file. */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ];
    }
}
