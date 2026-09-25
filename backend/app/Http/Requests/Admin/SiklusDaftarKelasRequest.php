<?php

namespace App\Http\Requests\Admin;

use App\Http\Controllers\Api\Concerns\FilterGlobal;
use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

class SiklusDaftarKelasRequest extends FormRequest
{
    use FilterGlobal;

    protected function prepareForValidation(): void
    {
        $this->merge($this->normalisasiFilterInputs([
            'jenjang',
            'tahun_ajaran',
            'semester',
            'tingkat',
            'kelas_id',
        ]));
    }

    /** Cermin authorize('viewAny', Santri::class) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('viewAny', Santri::class);
    }

    public function rules(): array
    {
        return [
            'jenjang' => ['required', 'array', 'min:1'],
            'jenjang.*' => ['string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['nullable', 'array'],
            'tahun_ajaran.*' => ['string', 'exists:tahun_ajaran,nama'],
            'semester' => ['nullable', 'array'],
            'semester.*' => ['in:1,2'],
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
