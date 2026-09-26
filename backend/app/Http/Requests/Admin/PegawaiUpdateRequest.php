<?php

namespace App\Http\Requests\Admin;

class PegawaiUpdateRequest extends PegawaiStoreRequest
{
    public function rules(): array
    {
        $aturan = parent::rules();
        $aturan['nama_lengkap'] = ['sometimes', 'string', 'max:255'];
        $aturan['jenis_kelamin'] = ['sometimes', 'in:L,P'];

        return $aturan;
    }
}
