<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class KelasUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tingkat' => ['nullable', 'string', 'max:20'],
            'nama_kelas' => ['sometimes', 'required', 'string', 'max:50'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
            'urutan' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
