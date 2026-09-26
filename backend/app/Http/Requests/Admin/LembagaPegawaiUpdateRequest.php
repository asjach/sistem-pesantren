<?php

namespace App\Http\Requests\Admin;

class LembagaPegawaiUpdateRequest extends LembagaPegawaiStoreRequest
{
    public function rules(): array
    {
        $aturan = parent::rules();
        $aturan['jenjang'] = ['sometimes', 'string', 'exists:lembaga,jenjang'];

        return $aturan;
    }
}
