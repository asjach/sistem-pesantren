<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Koreksi arsip alumni: kunci santri/lembaga/tahun dikunci, field arsip boleh diubah. */
class AlumniUpdateRequest extends FormRequest
{
    /** Cermin authorizeLembaga controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        $row = $this->route('alumni');

        return $row !== null && (bool) $this->user()?->canAccessLembaga($row->lembaga_lulus);
    }

    public function rules(): array
    {
        return [
            'tanggal_lulus' => ['sometimes', 'nullable', 'date'],
            'nomor_ijazah' => ['sometimes', 'nullable', 'string'],
            'no_peserta' => ['sometimes', 'nullable', 'string', 'max:30'],
            'skhun' => ['sometimes', 'nullable', 'string', 'max:50'],
            'no_surat_ijazah' => ['sometimes', 'nullable', 'string', 'max:50'],
            'kegiatan_setelah_lulus' => ['sometimes', 'nullable', 'string'],
            'penyerahan_ijazah' => ['sometimes', 'nullable', 'in:sudah,belum'],
            'melanjutkan' => ['sometimes', 'nullable', 'in:ya,tidak'],
            'catatan' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
