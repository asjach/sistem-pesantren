<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Validasi penetapan semester aktif satu lembaga. */
class SemesterAktifUpsertRequest extends FormRequest
{
    /** Pemeriksaan izin lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'semester' => ['required', Rule::in(['1', '2'])],
        ];
    }
}
