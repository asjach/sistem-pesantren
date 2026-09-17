<?php

namespace App\Http\Requests\Admin;

use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

class SiklusDaftarKelasRequest extends FormRequest
{
    /** Cermin authorize('viewAny', Santri::class) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('viewAny', Santri::class);
    }

    public function rules(): array
    {
        return [
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'tahun_ajaran_id' => ['nullable', 'integer', 'exists:tahun_ajaran,id'],
            'semester' => ['nullable', 'in:1,2'],
            'kelas_id' => ['nullable', 'integer', 'exists:kelas,id'],
            'tingkat' => ['nullable', 'string'],
        ];
    }
}
