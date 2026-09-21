<?php

namespace App\Http\Requests\Admin;

use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

class RiwayatStoreRequest extends FormRequest
{
    /** Cermin authorize('viewAny') controller agar 403 tetap sebelum validasi. */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('viewAny', Santri::class);
    }

    public function rules(): array
    {
        return [
            'santri_id' => ['required', 'exists:santri,id'],
            'lembaga_id' => ['required', 'exists:lembaga,id'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'kelas_id' => ['nullable', 'exists:kelas,id'],
            'tingkat' => ['nullable', 'string', 'max:20'],
            'no_absen' => ['nullable', 'integer', 'min:1'],
            'status_awal' => ['nullable', 'string', 'max:50'],
            'tgl_masuk' => ['nullable', 'date'],
            'nis_lokal' => ['nullable', 'string', 'max:20'],
        ];
    }
}
