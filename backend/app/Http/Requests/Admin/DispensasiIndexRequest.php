<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir filter daftar dispensasi. */
class DispensasiIndexRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tahun_ajaran' => 'nullable|string|max:20',
            'jenis_id' => 'nullable|integer|exists:jenis_tagihan,id',
            'santri_id' => 'nullable|integer|exists:santri,id',
        ];
    }
}
