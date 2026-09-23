<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class KelasWalasRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Tetapkan/lepas wali kelas: id pegawai, atau null untuk melepas. */
    public function rules(): array
    {
        return [
            'pegawai_id' => ['nullable', 'integer', 'exists:pegawai,id'],
        ];
    }
}
