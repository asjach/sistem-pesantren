<?php

namespace App\Http\Requests\Admin;

use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

/** Aturan kolom profil identitas santri (dipakai store & update). */
abstract class SantriProfilRequest extends FormRequest
{
    protected function aturanProfil(): array
    {
        $aturan = [];
        foreach (Santri::KOLOM_PROFIL as $kolom) {
            $aturan[$kolom] = ['sometimes', 'nullable', 'string', 'max:255'];
        }
        $aturan['nama_lengkap'] = ['sometimes', 'required', 'string', 'max:255'];
        $aturan['alamat'] = ['sometimes', 'nullable', 'string', 'max:500'];
        $aturan['nik'] = $aturan['ayah_nik'] = $aturan['ibu_nik'] = $aturan['wali_nik'] = ['sometimes', 'nullable', 'digits:16'];
        $aturan['no_kk'] = ['sometimes', 'nullable', 'digits:16'];
        $aturan['nisn'] = ['sometimes', 'nullable', 'digits:10'];
        $aturan['jk'] = ['sometimes', 'nullable', 'in:L,P'];
        $aturan['tipe_santri'] = ['sometimes', 'nullable', 'in:asrama,non_asrama'];
        $aturan['anak_ke'] = $aturan['j_saudara'] = ['sometimes', 'nullable', 'integer', 'min:0'];
        $aturan['email_santri'] = ['sometimes', 'nullable', 'email', 'max:255'];
        $aturan['no_hp_santri'] = $aturan['ayah_telp'] = $aturan['ibu_telp'] = $aturan['wali_telp'] = ['sometimes', 'nullable', 'string', 'max:20'];
        $aturan['rt'] = $aturan['rw'] = ['sometimes', 'nullable', 'string', 'max:3'];
        foreach (['tgl_lahir', 'ayah_tgl_lahir', 'ibu_tgl_lahir', 'wali_tgl_lahir', 'tanggal_masuk'] as $k) {
            $aturan[$k] = ['sometimes', 'nullable', 'date'];
        }

        return $aturan;
    }
}
