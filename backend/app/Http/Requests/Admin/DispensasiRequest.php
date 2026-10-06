<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir tambah/ubah dispensasi. */
class DispensasiRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => 'required|string|max:100',
            'keterangan' => 'nullable|string|max:255',
            'tahun_ajaran' => 'required|string|exists:tahun_ajaran,nama',
            'aturan' => 'required|array|min:1',
            'aturan.*.jenis_id' => 'nullable|integer|exists:jenis_tagihan,id',
            'aturan.*.tipe' => 'required|in:persen,nominal,bebas',
            'aturan.*.nilai' => 'required|integer|min:0',
            'santri_ids' => 'nullable|array',
            'santri_ids.*' => 'integer|exists:santri,id',
            'is_active' => 'nullable|boolean',
        ];
    }
}
