<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PsbKuotaUpsertRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'gelombang_id' => ['required', 'integer', 'exists:psb_gelombang,id'],
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'tipe_santri' => ['required', 'in:semua,asrama,non_asrama'],
            'kuota' => ['nullable', 'integer', 'min:0'],
            'paket_tersedia' => ['nullable', 'boolean'],
            'membutuhkan_seleksi' => ['nullable', 'boolean'],
            'membutuhkan_pemberkasan' => ['nullable', 'boolean'],
        ];
    }
}
