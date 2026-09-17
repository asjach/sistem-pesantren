<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PresetTabelStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'table_key' => ['required', 'string', 'max:60'],
            'nama' => ['required', 'string', 'max:50'],
            'lembaga_ids' => ['required', 'array', 'min:1', 'max:200'],
            'lembaga_ids.*' => ['integer', 'exists:lembaga,id'],
            'kolom' => ['required', 'array', 'min:1', 'max:200'],
            'kolom.*' => ['string', 'max:60'],
            'label' => ['nullable', 'array', 'max:200'],
            'label.*' => ['nullable', 'string', 'max:60'],
        ];
    }
}
