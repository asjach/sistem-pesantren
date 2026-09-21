<?php

namespace App\Http\Requests\Admin;

use App\Models\TahunAjaran;
use Illuminate\Foundation\Http\FormRequest;

class TahunAjaranStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => ['required', 'string', 'max:50', 'regex:'.TahunAjaran::POLA],
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_selesai' => ['nullable', 'date', 'after_or_equal:tanggal_mulai'],
        ];
    }

    public function messages(): array
    {
        return ['nama.regex' => 'Nama tahun ajaran harus berpola YYYY/YYYY (mis. 2025/2026).'];
    }
}
