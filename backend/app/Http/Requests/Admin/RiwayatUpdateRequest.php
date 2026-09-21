<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RiwayatUpdateRequest extends FormRequest
{
    /** Cermin authorizeLembaga controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        $row = $this->route('riwayat');

        return $row !== null && (bool) $this->user()?->canAccessLembaga((int) $row->lembaga_id);
    }

    /**
     * Hanya kolom skalar aman: status/kelas/FK/timestamp dikunci —
     * status via pintu lifecycle, kelas via set/pindah-kelas.
     */
    public function rules(): array
    {
        $row = $this->route('riwayat');

        return [
            'semester' => [
                'sometimes', 'string', 'in:1,2',
                Rule::unique('riwayat_belajar', 'semester')
                    ->ignore($row?->id)
                    ->where(fn ($q) => $q
                        ->where('santri_id', $row?->santri_id)
                        ->where('tahun_ajaran', $row?->tahun_ajaran)
                        ->where('lembaga_id', $row?->lembaga_id)),
            ],
            'tingkat' => ['sometimes', 'nullable', 'string', 'max:20'],
            'no_absen' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'tgl_masuk' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
