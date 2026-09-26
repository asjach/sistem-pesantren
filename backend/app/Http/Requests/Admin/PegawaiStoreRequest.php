<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PegawaiStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama_lengkap' => ['required', 'string', 'max:255'],
            'nip' => ['nullable', 'string', 'max:50'],
            'nik' => ['nullable', 'string', 'max:20'],
            'gelar_depan' => ['nullable', 'string', 'max:50'],
            'gelar_belakang' => ['nullable', 'string', 'max:50'],
            'jenis_kelamin' => ['required', 'in:L,P'],
            'tempat_lahir' => ['nullable', 'string', 'max:100'],
            'tanggal_lahir' => ['nullable', 'date'],
            'no_hp' => ['nullable', 'string', 'max:20'],
            'email_pribadi' => ['nullable', 'email', 'max:255'],
            'email_gws' => ['nullable', 'email', 'max:255'],
            'npwp' => ['nullable', 'string', 'max:50'],
            'no_kk' => ['nullable', 'string', 'max:20'],
            'status_pernikahan' => ['nullable', 'string', 'max:100'],
            'agama' => ['nullable', 'string', 'max:100'],
            'no_bpjs' => ['nullable', 'string', 'max:50'],
            'gol_darah' => ['nullable', 'string', 'max:10'],
            'status_tempat_tinggal' => ['nullable', 'string', 'max:100'],
            'pendidikan_terakhir' => ['nullable', 'string', 'max:100'],
            'niat_npa' => ['nullable', 'string', 'max:100'],
            'jenis_ptk' => ['nullable', 'string', 'max:100'],
            'jarak_ke_pesantren' => ['nullable', 'string', 'max:100'],
            'waktu_tempuh' => ['nullable', 'string', 'max:100'],
            'transportasi' => ['nullable', 'string', 'max:100'],
            'sertifikasi' => ['nullable', 'in:sudah,belum'],
            'provinsi' => ['nullable', 'string', 'max:100'],
            'kab_kota' => ['nullable', 'string', 'max:100'],
            'kecamatan' => ['nullable', 'string', 'max:100'],
            'desa_kelurahan' => ['nullable', 'string', 'max:100'],
            'rt' => ['nullable', 'string', 'max:3'],
            'rw' => ['nullable', 'string', 'max:3'],
            'kode_pos' => ['nullable', 'string', 'max:10'],
            'alamat' => ['nullable', 'string'],
            'tgl_mulai_kerja' => ['nullable', 'date'],
            'status_aktif' => ['nullable', 'in:aktif,cuti,keluar'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ];
    }
}
