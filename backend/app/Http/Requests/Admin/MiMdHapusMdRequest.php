<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi batch hapus jejak MD. */
class MiMdHapusMdRequest extends FormRequest
{
    /** Pemeriksaan izin & pasangan MI/MD tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.santri_id' => ['required', 'integer', 'exists:santri,id'],
        ];
    }
}
