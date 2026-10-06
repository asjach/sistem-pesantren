<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir tambah tagihan. */
class TagihanStoreRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'santri_id' => 'required|integer|exists:santri,id',
            'jenjang' => 'required|string',
            'tahun_ajaran' => 'required|string|max:9',
            'jenis_id' => 'required|integer|exists:jenis_tagihan,id',
            'periode' => 'nullable|string|max:20',
            'nominal' => 'required|integer|min:0',
            'jatuh_tempo' => 'nullable|date',
        ];
    }
}
