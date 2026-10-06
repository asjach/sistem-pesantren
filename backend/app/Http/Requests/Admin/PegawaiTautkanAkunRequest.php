<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi tautkan/lepas akun login pegawai (null = lepas). */
class PegawaiTautkanAkunRequest extends FormRequest
{
    /** Pemeriksaan izin tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ];
    }
}
