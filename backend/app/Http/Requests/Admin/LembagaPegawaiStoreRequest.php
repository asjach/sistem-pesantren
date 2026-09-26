<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LembagaPegawaiStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jenjang' => ['required', Rule::exists('lembaga', 'jenjang')],
            'nipp' => ['nullable', 'string', 'max:30'],
            'tugas_utama' => ['nullable', 'string', 'max:100'],
            'is_active_lembaga' => ['nullable', 'in:Ya,Tidak'],
            'tgl_masuk' => ['nullable', 'date'],
            'tgl_selesai' => ['nullable', 'date'],
            'tahaj_masuk' => ['nullable', 'string', 'max:50'],
            'no_sk_awal_ptk' => ['nullable', 'string', 'max:100'],
            'tgl_sk_awal_ptk' => ['nullable', 'date'],
        ];
    }
}
