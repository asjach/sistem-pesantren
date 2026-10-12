<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class KomponenCustomHapusRequest extends FormRequest
{
    /** Kembalikan setelan komponen ke bawaan; diatur dari popover klik-kanan,
     *  jadi terbuka untuk semua pengguna terautentikasi. */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'table_key' => ['sometimes', 'string', 'max:60'],
            'komponen' => ['required', 'string', 'max:60', 'regex:/^[a-z0-9_]{1,60}$/'],
        ];
    }
}