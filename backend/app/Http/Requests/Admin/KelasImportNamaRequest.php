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
            'lembaga_id' => ['nullable', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'tahun_ajaran_id' => ['nullable', 'exists:tahun_ajaran,id'],
            'dari_kode' => ['nullable', 'in:MI,MD'],
            'dari_lembaga_id' => ['nullable', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'dari_tahun_ajaran_id' => ['nullable', 'exists:tahun_ajaran,id'],
            'ke_kode' => ['nullable', 'in:MI,MD'],
            'periksa' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
            'dari_lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ];
    }
}
