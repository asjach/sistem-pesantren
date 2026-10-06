<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir ubah jenis tagihan. */
class JenisUpdateRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $jenis = $this->route('jenis');
        $jenisId = is_object($jenis) ? $jenis->id : $jenis;

        return [
            'nama' => 'required|string|max:100|unique:jenis_tagihan,nama,'.$jenisId,
            'tipe' => 'in:bulanan,non_bulanan',
            'is_active' => 'boolean',
            'jenjang' => 'nullable|string|max:50',
        ];
    }
}
