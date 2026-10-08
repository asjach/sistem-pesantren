<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir generate tagihan massal. */
class TagihanGenerateRequest extends FormRequest
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
            'jenis_id' => 'required|integer|exists:jenis_tagihan,id',
            'periode' => 'nullable|string|max:20',
            'periode_sampai' => 'nullable|string|max:20',
            'jatuh_tempo' => 'nullable|date',
            'nominal' => 'required|integer|min:0',
            'santri' => 'required|array|min:1',
            'santri.*.santri_id' => 'required|integer|distinct|exists:santri,id',
            'santri.*.nominal' => 'nullable|integer|min:0',
            // Paket sementara yang dicentang generate ini (tetap selalu otomatis).
            'dispensasi_sementara_ids' => 'nullable|array',
            'dispensasi_sementara_ids.*' => 'integer|exists:dispensasi,id',
        ];
    }
}
