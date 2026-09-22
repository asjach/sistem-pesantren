<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PsbDokumenStoreWajibRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'psb_kegiatan_id' => ['required', 'exists:psb_kegiatan,id'],
            'jenjang' => ['required', 'exists:lembaga,jenjang'],
            'jenis_dokumen_santri' => ['required', 'string', 'max:50'],
            'is_wajib' => ['sometimes', 'boolean'],
        ];
    }
}
