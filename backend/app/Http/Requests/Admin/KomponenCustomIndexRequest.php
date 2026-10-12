<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class KomponenCustomIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            /* String kosong = komponen di luar tabel (dialog/form/popover).
               `nullable` WAJIB: Laravel mengubah string kosong jadi `null`
               (`ConvertEmptyStringsToNull`), dan tanpa `nullable` permintaan
               `?table_key=` ditolak dengan "The table key field must be a
               string.". */
            'table_key' => ['sometimes', 'nullable', 'string', 'max:60'],
        ];
    }
}