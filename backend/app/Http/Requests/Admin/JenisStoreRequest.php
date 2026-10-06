<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir tambah jenis tagihan. */
class JenisStoreRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => 'required|string|max:100|unique:jenis_tagihan,nama',
            'tipe' => 'in:bulanan,non_bulanan',
            'jenjang' => 'nullable|string|max:50',
        ];
    }
}
