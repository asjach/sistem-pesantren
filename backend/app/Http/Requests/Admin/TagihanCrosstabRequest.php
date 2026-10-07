<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir filter crosstab tagihan. */
class TagihanCrosstabRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tahun_ajaran' => 'nullable',
            'tahun_ajaran.*' => 'string|max:20',
            'jenjang' => 'nullable|array',
            'jenjang.*' => 'string|max:20',
            'jenis_id' => 'nullable|integer|exists:jenis_tagihan,id',
            'status' => 'nullable|in:belum,sebagian,lunas',
            'belum_lunas' => 'nullable|boolean',
            'terlambat' => 'nullable|boolean',
            'santri' => 'nullable|string|max:100',
            // Filter rail (tingkat & kelas) memakai kontrak yang sama seperti
            // halaman Santri: tingkat = kode, kelas = id (bukan nama).
            'tingkat' => 'nullable|array',
            'tingkat.*' => 'string|max:20',
            'kelas_id' => 'nullable|array',
            'kelas_id.*' => 'integer|exists:kelas,id',
        ];
    }
}
