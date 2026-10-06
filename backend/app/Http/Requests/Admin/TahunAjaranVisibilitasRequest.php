<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi payload sembunyikan/tampilkan tahun ajaran per lembaga (bentuk sama). */
class TahunAjaranVisibilitasRequest extends FormRequest
{
    /** Pemeriksaan izin super_admin/lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => ['required', 'string'],
            'jenjang' => ['nullable', 'string', 'exists:lembaga,jenjang'],
        ];
    }
}
