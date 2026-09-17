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
        return [
            'lembaga_id' => 'nullable|exists:lembaga,id',
            'nama' => 'required_without:kode|string',
            'kode' => 'required_without:nama|string',
            'urutan' => 'nullable|integer',
        ];
    }
}
