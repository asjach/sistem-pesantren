<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PsbKegiatanUpdateRequest extends FormRequest
{
    /** Kegiatan & gelombang PSB hanya dikelola admin pesantren (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->bolehPesantren();
    }

    public function rules(): array
    {
        return [
            'tahun_ajaran' => ['sometimes', 'string', 'exists:tahun_ajaran,nama',
                Rule::unique('psb_kegiatan', 'tahun_ajaran')->ignore($this->route('kegiatan')?->id)],
            'nama' => ['sometimes', 'string', 'max:100'],
            'is_aktif' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'tahun_ajaran.unique' => 'Tahun ajaran ini sudah memiliki kegiatan PSB.',
        ];
    }
}
