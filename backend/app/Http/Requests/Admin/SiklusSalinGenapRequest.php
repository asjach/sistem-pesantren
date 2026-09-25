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
            'jenjang' => 'required|exists:lembaga,jenjang',
            'tanggal_masuk' => 'required|date',
            'konteks_aktif' => 'nullable|boolean',
            'tahun_ajaran' => 'nullable|exists:tahun_ajaran,nama',
            'tingkat' => 'nullable|array',
            'tingkat.*' => 'nullable|string|max:20',
            'kelas_id' => 'nullable|array',
            'kelas_id.*' => 'nullable|integer|exists:kelas,id',
            'q' => 'nullable|string|max:100',
            'siswa' => 'nullable|array|min:1',
            'siswa.*.santri_id' => 'required|exists:santri,id',
            'siswa.*.riwayat_id' => 'nullable|integer|exists:riwayat_belajar,id',
            'siswa.*.kelas_id' => 'nullable|exists:kelas,id',
            'siswa.*.no_absen' => 'nullable|integer|min:1',
        ];
    }
}
