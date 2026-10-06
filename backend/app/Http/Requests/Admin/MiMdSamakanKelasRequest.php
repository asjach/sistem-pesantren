<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi batch samakan kelas MI/MD. */
class MiMdSamakanKelasRequest extends FormRequest
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
            'items.*.arah' => ['required', 'in:ke_mi,ke_md'],
        ];
    }
}
