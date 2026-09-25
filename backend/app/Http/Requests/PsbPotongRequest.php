<?php

namespace App\Http\Requests;

use App\Http\Requests\Admin\PotongImportRequest;

/**
 * Import bertahap PSB: gelombang + lembaga adalah konteks tetap (bukan
 * per baris) dan wajib dikirim pada SESI baru maupun setiap potongan
 * lanjutan supaya backend tak bisa salah sasaran.
 */
class PsbPotongRequest extends PotongImportRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return parent::rules() + [
            'gelombang_id' => ['required', 'integer', 'exists:psb_gelombang,id'],
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
        ];
    }
}
