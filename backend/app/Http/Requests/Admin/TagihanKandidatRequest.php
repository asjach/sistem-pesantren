<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir kandidat generate tagihan. */
class TagihanKandidatRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tahun_ajaran' => 'required|string|max:9',
            'kelompok' => 'required|string|in:mi_saja,md_saja,mi,md,mi_md,aktif,kelas_akhir,selain_kelas_akhir,custom',
            'jenis_id' => 'nullable|integer|exists:jenis_tagihan,id',
            'periode' => 'nullable|string|max:20',
            'periode_sampai' => 'nullable|string|max:20',
            'q' => 'nullable|string|max:100',
        ];
    }
}
