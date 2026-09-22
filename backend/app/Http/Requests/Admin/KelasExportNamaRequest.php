<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class KelasExportNamaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jenjang' => ['required', Rule::exists('lembaga', 'jenjang')],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ];
    }

    public function messages(): array
    {
        return [
            'jenjang.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ];
    }
}
