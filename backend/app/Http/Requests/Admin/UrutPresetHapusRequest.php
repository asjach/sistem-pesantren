<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UrutPresetHapusRequest extends FormRequest
{
    /** Preset urut (global) hanya dikelola super_admin (403 sebelum validasi). */
    public function authorize(): bool
    {
        return $this->user()?->bolehSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'table_key' => ['required', 'string', 'max:60'],
        ];
    }
}
