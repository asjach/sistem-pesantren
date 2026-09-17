<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PsbGelombangUpdateRequest extends FormRequest
{
    /** Kegiatan & gelombang PSB hanya dikelola admin pesantren (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->bolehPesantren();
    }

    public function rules(): array
    {
        return [
            'nama' => ['sometimes', 'string', 'max:100'],
            'tgl_buka' => ['sometimes', 'date'],
            'tgl_tutup' => ['sometimes', 'date'],
        ];
    }
}
