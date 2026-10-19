<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ReferensiStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tipe = (string) $this->route('tipe');

        $isStatus = in_array($tipe, ['status_awal', 'status_akhir'], true);

        $rules = [

            'jenjang' => 'nullable',
            'jenjang.*' => 'string|exists:lembaga,jenjang',
            'kode' => $isStatus ? 'required|string' : 'nullable|string',
            'nama' => $isStatus ? 'nullable|string' : 'required|string',
            'urutan' => 'nullable|integer',
        ];

        if ($tipe === 'mapel') {
            $rules['kode'] = 'nullable|string|max:20';
            $rules['singkatan'] = 'nullable|string|max:50';
        }

        return $rules;
    }
}
