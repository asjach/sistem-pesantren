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
            // String kosong = komponen di luar tabel (dialog/form/popover).
            'table_key' => ['sometimes', 'string', 'max:60'],
        ];
    }
}