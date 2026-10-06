<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir tambah tarif tagihan. */
class TarifStoreRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jenjang' => 'required|string',
            'tahun_ajaran' => 'required|string|max:9',
            'jenis_id' => 'required|integer|exists:jenis_tagihan,id',
            'tingkat' => 'nullable|string|max:100',
            'nominal' => 'required|integer|min:0',
        ];
    }
}
