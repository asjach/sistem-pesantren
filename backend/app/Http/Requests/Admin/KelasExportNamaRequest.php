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
            'lembaga_id' => ['required', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ];
    }

    public function messages(): array
    {
        return [
            'lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ];
    }
}
