<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir ubah grup santri custom. */
class GrupCustomUpdateRequest extends FormRequest
{
    /** Pemeriksaan izin tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $grup = $this->route('grup');
        $id = is_object($grup) ? $grup->id : $grup;

        return [
            'nama' => 'required|string|max:100|unique:grup_santri_custom,nama,'.$id,
            'keterangan' => 'nullable|string|max:1000',
            'jenjang' => 'nullable|string|max:50',
            'tahun_ajaran' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ];
    }
}
