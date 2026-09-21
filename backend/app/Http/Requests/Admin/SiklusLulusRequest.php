<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SiklusLulusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'lembaga_id' => 'required|exists:lembaga,id',
            'tahun_ajaran_lulus' => 'required|string|exists:tahun_ajaran,nama',
            'tanggal_lulus' => 'required|date',
            'nomor_ijazah' => ['nullable', 'string'],
            'no_surat_ijazah' => ['nullable', 'string', 'max:50'],
            'kegiatan_setelah_lulus' => ['nullable', 'string'],
            'penyerahan_ijazah' => ['nullable', 'in:sudah,belum'],
            'melanjutkan' => ['nullable', 'in:ya,tidak'],
        ];
    }
}
