<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PsbLengkapiRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Tahap 2, mirror santri 1:1 (Modul 100 PSB Penerimaan).
     */
    public function rules(): array
    {
        return [
            'jk' => ['required', 'in:L,P'], // wajib di tahap 2 (kolom santri.jk NOT NULL untuk ACC)
            'nama_singkat' => ['nullable', 'string', 'max:50'],
            'j_saudara' => ['nullable', 'integer', 'min:0'],
            'nisn' => ['nullable', 'digits:10'],
            'tmp_lahir' => ['nullable', 'string', 'max:50'],
            'anak_ke' => ['nullable', 'integer', 'min:1'],
            // Kamus bebas (string, tanpa exists — selaras santri):
            'agama' => ['nullable', 'string', 'max:50'],
            'cita_cita' => ['nullable', 'string', 'max:50'],
            'hobi' => ['nullable', 'string', 'max:50'],
            'kebutuhan_khusus' => ['nullable', 'string', 'max:50'],
            'kebutuhan_disabilitas' => ['nullable', 'string', 'max:50'],
            'nomor_kip' => ['nullable', 'string', 'max:50'],
            'no_hp_santri' => ['nullable', 'string', 'max:20'],
            'email_santri' => ['nullable', 'email', 'max:255'],
            'no_kk' => ['nullable', 'digits:16'],
            'kewarganegaraan' => ['nullable', 'string', 'max:10'],
            'bahasa_sehari' => ['nullable', 'string', 'max:50'],
            'status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'jarak_ke_pesantren' => ['nullable', 'string', 'max:50'],
            'waktu_tempuh' => ['nullable', 'string', 'max:50'],
            'transportasi' => ['nullable', 'string', 'max:50'],
            'tanggal_masuk' => ['nullable', 'date'],
            'alamat' => ['nullable', 'string'],
            'provinsi' => ['nullable', 'string', 'max:50'],
            'kab_kota' => ['nullable', 'string', 'max:50'],
            'kecamatan' => ['nullable', 'string', 'max:50'],
            'desa_kelurahan' => ['nullable', 'string', 'max:50'],
            'rt' => ['nullable', 'string', 'max:3'],
            'rw' => ['nullable', 'string', 'max:3'],
            'kode_pos' => ['nullable', 'string', 'max:10'],
            'ayah_nama' => ['nullable', 'string', 'max:100'],
            'ayah_nik' => ['nullable', 'digits:16'],
            'ayah_tmp_lahir' => ['nullable', 'string', 'max:50'],
            'ayah_tgl_lahir' => ['nullable', 'date'],
            'ayah_status' => ['nullable', 'string', 'max:50'],
            'ayah_pendidikan' => ['nullable', 'string', 'max:50'],
            'ayah_pekerjaan' => ['nullable', 'string', 'max:50'],
            'ayah_penghasilan' => ['nullable', 'string', 'max:50'],
            'ayah_telp' => ['nullable', 'string', 'max:20'],
            'ayah_alamat' => ['nullable', 'string'],
            'ayah_status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'ibu_nama' => ['nullable', 'string', 'max:100'],
            'ibu_nik' => ['nullable', 'digits:16'],
            'ibu_tmp_lahir' => ['nullable', 'string', 'max:50'],
            'ibu_tgl_lahir' => ['nullable', 'date'],
            'ibu_status' => ['nullable', 'string', 'max:50'],
            'ibu_pendidikan' => ['nullable', 'string', 'max:50'],
            'ibu_pekerjaan' => ['nullable', 'string', 'max:50'],
            'ibu_penghasilan' => ['nullable', 'string', 'max:50'],
            'ibu_telp' => ['nullable', 'string', 'max:20'],
            'ibu_alamat' => ['nullable', 'string'],
            'ibu_status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'wali_nama' => ['nullable', 'string', 'max:100'],
            'wali_nik' => ['nullable', 'digits:16'],
            'wali_tmp_lahir' => ['nullable', 'string', 'max:50'],
            'wali_tgl_lahir' => ['nullable', 'date'],
            'wali_status' => ['nullable', 'string', 'max:50'],
            'wali_pendidikan' => ['nullable', 'string', 'max:50'],
            'wali_pekerjaan' => ['nullable', 'string', 'max:50'],
            'wali_penghasilan' => ['nullable', 'string', 'max:50'],
            'wali_telp' => ['nullable', 'string', 'max:20'],
            'wali_alamat' => ['nullable', 'string'],
            'wali_status_tempat_tinggal' => ['nullable', 'string', 'max:50'],
            'yang_membiayai' => ['nullable', 'string', 'max:50'],
            'foto' => ['nullable', 'file', 'mimes:jpg,jpeg,png', 'max:2048'],
        ];
    }
}
