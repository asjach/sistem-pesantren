<?php

namespace App\Http\Requests\Admin;

use App\Models\TahunAjaran;
use Illuminate\Foundation\Http\FormRequest;

class TahunAjaranUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // `nama` = kunci baris yang diubah; `nama_baru` opsional untuk rename.
            'nama' => ['required', 'string', 'max:50'],
            'nama_baru' => ['nullable', 'string', 'max:50', 'regex:'.TahunAjaran::POLA],
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_selesai' => ['nullable', 'date'],
            'semester_aktif' => ['nullable', 'in:1,2'],
        ];
    }

    public function messages(): array
    {
        return ['nama_baru.regex' => 'Nama tahun ajaran harus berpola YYYY/YYYY (mis. 2025/2026).'];
    }
}
