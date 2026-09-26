<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class KeaktifanPegawaiStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'pegawai_id' => ['required', 'integer', 'exists:pegawai,id'],
            'jenjang' => ['required', Rule::exists('lembaga', 'jenjang')],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'tugas_utama' => ['nullable', 'string', 'max:100'],
            'no_sk' => ['nullable', 'string', 'max:100'],
            'tgl_sk' => ['nullable', 'date'],
            'status_keaktifan' => ['nullable', 'in:aktif,inaktif'],
        ];
    }
}
