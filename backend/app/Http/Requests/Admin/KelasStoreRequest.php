<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class KelasStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Kelas selalu milik lembaga operasional (bukan root pesantren).
            'lembaga_id' => ['required', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            // Mode tunggal (kompatibel lama) atau bulk via items (sub-form dialog).
            'nama_kelas' => ['required_without:items', 'string', 'max:50'],
            'tingkat' => ['nullable', 'string', 'max:20'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
            'urutan' => ['nullable', 'integer', 'min:0'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.nama_kelas' => ['required', 'string', 'max:50'],
            'items.*.tingkat' => ['nullable', 'string', 'max:20'],
            'items.*.kapasitas' => ['nullable', 'integer', 'min:1'],
            'items.*.urutan' => ['nullable', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'lembaga_id.exists' => 'Lembaga harus lembaga operasional (bukan induk pesantren).',
        ];
    }
}
