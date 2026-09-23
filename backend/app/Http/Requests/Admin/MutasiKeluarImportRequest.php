<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class MutasiKeluarImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Import arsip mutasi multi-lembaga: lingkup ada per baris, request hanya file. */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ];
    }
}
