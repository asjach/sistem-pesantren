<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Aturan bersama tambah/ubah lembaga (update mengabaikan kunci `jenjang`). */
abstract class LembagaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function jenjangLembaga(): ?string
    {
        $param = $this->route('lembaga');

        return is_object($param) ? $param->jenjang : ($param !== null ? (string) $param : null);
    }

    /** Bidang identitas/legalitas/alamat yang sama untuk tambah & ubah. */
    protected function aturanDasar(): array
    {
        $jenjang = $this->jenjangLembaga();

        return [
            'nama' => ['sometimes', 'string', 'max:100'],
            'nama_singkat' => ['nullable', 'string', 'max:50'],
            'mudir_am' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:negeri,swasta'],
            'npsn' => ['nullable', 'string', 'max:20', Rule::unique('lembaga', 'npsn')->ignore($jenjang, 'jenjang')],
            'nsm' => ['nullable', 'string', 'max:30', Rule::unique('lembaga', 'nsm')->ignore($jenjang, 'jenjang')],
            'npwp' => ['nullable', 'string', 'max:30'],
            'no_izin_operasional' => ['nullable', 'string', 'max:100'],
            'tgl_izin' => ['nullable', 'date'],
            'no_sk_pendirian' => ['nullable', 'string', 'max:100'],
            'tgl_sk_pendirian' => ['nullable', 'date'],
            'tahun_berdiri' => ['nullable', 'integer', 'min:1800', 'max:2100'],
            'no_sk_kemenkumham' => ['nullable', 'string', 'max:100'],
            'akreditasi' => ['nullable', 'in:A,B,C,belum'],
            'tgl_akreditasi' => ['nullable', 'date'],
            'penyelenggara' => ['nullable', 'string', 'max:100'],
            'provinsi' => ['nullable', 'string', 'max:100'],
            'kab_kota' => ['nullable', 'string', 'max:100'],
            'kecamatan' => ['nullable', 'string', 'max:100'],
            'desa' => ['nullable', 'string', 'max:100'],
            'rt' => ['nullable', 'string', 'max:3'],
            'rw' => ['nullable', 'string', 'max:3'],
            'kode_pos' => ['nullable', 'string', 'max:10'],
            'alamat' => ['nullable', 'string'],
            'lintang' => ['nullable', 'numeric', 'between:-90,90'],
            'bujur' => ['nullable', 'numeric', 'between:-180,180'],
            'telepon' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:100'],
            'website' => ['nullable', 'string', 'max:100'],
            'logo_url' => ['nullable', 'string', 'max:255'],
            'waktu_belajar' => ['nullable', 'in:pagi,siang,pagi_siang'],
            'mode_rapor' => ['nullable', 'in:terpisah,digabung'],
            'template_rapor' => ['nullable', 'string', 'max:50'],
            'is_active' => ['nullable', 'boolean'],
            'kelompok_psb' => ['nullable', 'in:combo_mi_md,eksklusif'],
            'is_seleksi' => ['nullable', 'boolean'],
        ];
    }
}
