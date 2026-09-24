<?php

namespace App\Http\Requests\Admin;

use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

class SiklusDaftarKelasRequest extends FormRequest
{
    /** Cermin authorize('viewAny', Santri::class) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('viewAny', Santri::class);
    }

    public function rules(): array
    {
        return [
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['nullable', 'string', 'exists:tahun_ajaran,nama'],
            'semester' => ['nullable', 'in:1,2'],
            'kelas_id' => ['nullable', 'array'],
            'kelas_id.*' => ['integer', 'exists:kelas,id'],
            'tingkat' => ['nullable', 'array'],
            'tingkat.*' => ['string'],
            /** Cari nama/NIK santri atau NIS lokal. */
            'q' => ['nullable', 'string', 'max:100'],
            /** Basis tampil status_akhir: aktif = gabungan 6 status, nonaktif = keluar, semua = tanpa filter status. */
            'kelompok_status' => ['nullable', 'in:aktif,nonaktif,semua'],
            /** Matikan default TA/semester agar bisa lintas periode. */
            'lintas_periode' => ['nullable', 'boolean'],
        ];
    }
}
