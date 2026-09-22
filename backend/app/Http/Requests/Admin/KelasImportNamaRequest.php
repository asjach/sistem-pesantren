<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class KelasImportNamaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jenjang' => ['nullable', Rule::exists('lembaga', 'jenjang')],
            'tahun_ajaran' => ['nullable', 'string', 'exists:tahun_ajaran,nama'],
            'dari_kode' => ['nullable', 'in:MI,MD'],
            'dari_jenjang' => ['nullable', Rule::exists('lembaga', 'jenjang')],
            'dari_tahun_ajaran' => ['nullable', 'string', 'exists:tahun_ajaran,nama'],
            'ke_kode' => ['nullable', 'in:MI,MD'],
            'periksa' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'jenjang.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
            'dari_jenjang.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ];
    }
}
