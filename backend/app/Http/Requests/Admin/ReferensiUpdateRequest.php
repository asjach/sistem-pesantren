<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ReferensiUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rules = [
            'nama' => 'required|string',
            'urutan' => 'nullable|integer',
        ];

        // Kamus mapel punya kolom tambahan; namanya bukan kunci baris sehingga
        // boleh diperbaiki kapan saja (beda dari status, yang `kode`-nya kunci
        // data pemakai dan sengaja tidak bisa diubah).
        if ((string) $this->route('tipe') === 'mapel') {
            $rules['kode'] = 'nullable|string|max:20';
            $rules['singkatan'] = 'nullable|string|max:50';
        }

        return $rules;
    }
}
