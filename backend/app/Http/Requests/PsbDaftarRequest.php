<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PsbDaftarRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Tahap 1, publik (Modul 100 PSB Penerimaan).
     */
    public function rules(): array
    {
        return [
            'gelombang_id' => ['required', 'integer', 'exists:psb_gelombang,id'],
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'tahun_ajaran_id' => ['nullable', 'integer', 'exists:tahun_ajaran,id'], // null = ikut gelombang
            'tipe_santri' => ['required', 'in:asrama,non_asrama'],
            'nik' => ['required', 'digits:16'],
            'nama_lengkap' => ['required', 'string', 'max:100'],
            'jk' => ['nullable', 'in:L,P'],
            'tgl_lahir' => ['nullable', 'date'],
            'email_ortu' => ['nullable', 'email', 'max:100'], // boleh duplikat/ngasal, tidak dibandingkan ke users
            'telp_ortu' => ['nullable', 'string', 'max:20'],
            'nama_ayah' => ['nullable', 'string', 'max:100'],
            'nama_ibu' => ['nullable', 'string', 'max:100'],
            'santri_asal_id' => ['nullable', 'integer', 'exists:santri,id'], // pintu lanjutan
            'paket' => ['nullable', 'in:MI-MD'], // radio paket; satu-satunya paket saat ini (primer MI, non_asrama saja)
            'bukti_transfer' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:2048'], // disimpan ke storage, DB hanya path
        ];
    }
}
