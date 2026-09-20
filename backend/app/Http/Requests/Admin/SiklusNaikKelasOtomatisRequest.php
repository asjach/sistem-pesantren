<?php

namespace App\Http\Requests\Admin;

use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

class SiklusNaikKelasOtomatisRequest extends FormRequest
{
    /** Cermin authorize('viewAny', Santri::class) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('viewAny', Santri::class);
    }

    public function rules(): array
    {
        return [
            'lembaga_id' => 'required|exists:lembaga,id',
            'siswa' => 'required|array|min:1',
            'siswa.*.santri_id' => 'required|exists:santri,id',
            'siswa.*.status' => 'required|in:naik,tidak_naik',
            'siswa.*.tgl_masuk' => 'required|date',
        ];
    }
}
