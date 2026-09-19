<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ToolbarPresetSimpanRequest extends FormRequest
{
    /** Visibilitas kontrol hanya dikelola super_admin (403 sebelum validasi). */
    public function authorize(): bool
    {
        return $this->user()?->hasRole('super_admin') ?? false;
    }

    public function rules(): array
    {
        return [
            'table_key' => ['required', 'string', 'max:60'],
            'visibilitas' => ['present', 'array', 'max:20'],
            'visibilitas.*' => ['boolean'],
            'lebar' => ['sometimes', 'array', 'max:20'],
            'lebar.*' => ['integer', 'min:40', 'max:480'],
        ];
    }
}
