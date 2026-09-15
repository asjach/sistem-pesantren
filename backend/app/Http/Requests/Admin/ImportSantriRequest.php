<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ImportSantriRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Import buku induk: hanya file. Keanggotaan/riwayat punya import terpisah. */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ];
    }
}
