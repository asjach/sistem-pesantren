<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PsbKegiatanStoreRequest extends FormRequest
{
    /** Kegiatan & gelombang PSB hanya dikelola admin pesantren (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->bolehPesantren();
    }

    public function rules(): array
    {
        return [
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama', 'unique:psb_kegiatan,tahun_ajaran'],
            'nama' => ['required', 'string', 'max:100'],
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
