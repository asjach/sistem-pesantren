<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir ubah tarif tagihan. */
class TarifUpdateRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nominal' => 'required|integer|min:0',
            'is_active' => 'boolean',
        ];
    }
}
