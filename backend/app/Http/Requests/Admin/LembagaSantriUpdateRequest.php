<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class LembagaSantriUpdateRequest extends FormRequest
{
    /** Cermin authorizeLembaga controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        $row = $this->route('lembagaSantri');

        return $row !== null && (bool) $this->user()?->canAccessLembaga((int) $row->lembaga_id);
    }

    public function rules(): array
    {
        return [
            'nis_lokal' => ['sometimes', 'nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
            'tgl_mulai' => ['sometimes', 'nullable', 'date'],
            'tgl_selesai' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
