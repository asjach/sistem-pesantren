<?php

namespace App\Http\Requests\Admin;

use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

class SiklusSalinGenapRequest extends FormRequest
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
            'tanggal_masuk' => 'required|date',
            'siswa' => 'nullable|array|min:1',
            'siswa.*.santri_id' => 'required|exists:santri,id',
            'siswa.*.kelas_id' => 'nullable|exists:kelas,id',
            'siswa.*.no_absen' => 'nullable|integer|min:1',
        ];
    }
}
