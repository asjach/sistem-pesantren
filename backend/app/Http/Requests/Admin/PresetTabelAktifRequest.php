<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PresetTabelAktifRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'table_key' => ['required', 'string', 'max:60'],
            'preset_id' => ['nullable', 'integer', 'exists:preset_tabel,id'],

            'kolom' => ['nullable', 'array', 'max:200'],
            'kolom.*' => ['string', 'max:60'],
        ];
    }
}
