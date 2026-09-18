<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UrutPresetSimpanRequest extends FormRequest
{
    /** Preset urut (global) hanya dikelola super_admin (403 sebelum validasi). */
    public function authorize(): bool
    {
        return $this->user()?->hasRole('super_admin') ?? false;
    }

    public function rules(): array
    {
        return [
            'table_key' => ['required', 'string', 'max:60'],
            'opsi' => ['present', 'array', 'max:100'],
            'opsi.*.kode' => ['required', 'array', 'min:1', 'max:3'],
            'opsi.*.kode.*' => ['string', 'max:60'],
            'opsi.*.label' => ['required', 'string', 'max:60'],
            'opsi.*.arah' => ['nullable', Rule::in(['naik', 'turun'])],
            'opsi.*.bawaan' => ['sometimes', 'boolean'],
        ];
    }
}
