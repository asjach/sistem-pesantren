<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UrutPresetSimpanRequest extends FormRequest
{
    /** Preset urut hanya dikelola admin pesantren (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->bolehPesantren();
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
