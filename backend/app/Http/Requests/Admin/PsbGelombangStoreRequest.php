<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PsbGelombangStoreRequest extends FormRequest
{
    /** Kegiatan & gelombang PSB hanya dikelola admin pesantren (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->bolehPesantren();
    }

    public function rules(): array
    {
        return [
            'psb_kegiatan_id' => ['required', 'integer', 'exists:psb_kegiatan,id'],
            'nama' => ['required', 'string', 'max:100'],
            'tgl_buka' => ['required', 'date'],
            'tgl_tutup' => ['required', 'date'],
        ];
    }
}
