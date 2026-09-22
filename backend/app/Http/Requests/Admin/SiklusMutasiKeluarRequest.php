<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SiklusMutasiKeluarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jenjang' => 'required|exists:lembaga,jenjang',
            'tanggal_mutasi' => 'required|date',
            'alasan_mutasi' => 'required|string|max:100',
            'kelas_terakhir_id' => 'nullable|exists:kelas,id',
            'no_surat' => 'nullable|string|max:50',
            'nama_sekolah_tujuan' => 'nullable|string|max:255',
            'npsn_sekolah_tujuan' => 'nullable|string|max:20',
            'nsm_sekolah_tujuan' => 'nullable|string|max:30',
            'alamat_sekolah_tujuan' => 'nullable|string',
            'keterangan' => 'nullable|string',
        ];
    }
}
