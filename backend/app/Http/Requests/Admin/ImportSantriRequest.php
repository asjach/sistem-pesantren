<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ImportSantriRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Import buku induk & gabungan: hanya file. Riwayat akademik punya import terpisah. */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ];
    }
}
