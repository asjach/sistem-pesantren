<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UrutPresetHapusRequest extends FormRequest
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
        ];
    }
}
