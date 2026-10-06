<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi daftar pegawai aktif per lembaga + tahun ajaran. */
class PegawaiAktifRequest extends FormRequest
{
    /** Pemeriksaan izin lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jenjang' => ['required', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
        ];
    }
}
