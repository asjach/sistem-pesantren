<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PresetTabelUpdateRequest extends FormRequest
{
    /** Preset kolom (global) hanya dikelola super_admin (403 sebelum validasi). */
    public function authorize(): bool
    {
        return $this->user()?->hasRole('super_admin') ?? false;
    }

    public function rules(): array
    {
        return [
            'nama' => ['sometimes', 'string', 'max:50'],
            'kolom' => ['sometimes', 'array', 'min:1', 'max:200'],
            'kolom.*' => ['string', 'max:60'],
            'label' => ['sometimes', 'nullable', 'array', 'max:200'],
            'label.*' => ['nullable', 'string', 'max:60'],
        ];
    }
}
