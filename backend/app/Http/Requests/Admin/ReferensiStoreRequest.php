<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ReferensiStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tipe = (string) $this->route('tipe');
        // Status punya kunci `kode`; kamus bebas (termasuk mapel) berkunci `nama`.
        $isStatus = in_array($tipe, ['status_awal', 'status_akhir'], true);

        $rules = [
            // String = satu lembaga; array = beberapa lembaga sekaligus
            // (checkbox "Lembaga" di form Tambah entri). Kosong/tak ada =
            // super_admin menambah ke semua lembaga (fan-out).
            'jenjang' => 'nullable',
            'jenjang.*' => 'string|exists:lembaga,jenjang',
            'kode' => $isStatus ? 'required|string' : 'nullable|string',
            'nama' => $isStatus ? 'nullable|string' : 'required|string',
            'urutan' => 'nullable|integer',
        ];

        // Kolom tambahan kamus mapel (`ref_mapel.kode`/`singkatan`): hanya
        // tipe ini yang mengenalnya, jadi aturannya pun khusus di sini. Panjang
        // mengikuti kolomnya (20 & 50) supaya input panjang ditolak lebih awal.
        if ($tipe === 'mapel') {
            $rules['kode'] = 'nullable|string|max:20';
            $rules['singkatan'] = 'nullable|string|max:50';
        }

        return $rules;
    }
}
