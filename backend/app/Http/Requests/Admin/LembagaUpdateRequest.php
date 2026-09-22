<?php

namespace App\Http\Requests\Admin;

use Illuminate\Validation\Rule;

class LembagaUpdateRequest extends LembagaRequest
{
    public function rules(): array
    {
        // `jenjang` = kunci (PK) dan imutabel: hanya boleh dikirim bila sama.
        return ['jenjang' => ['sometimes', 'string', Rule::in([$this->jenjangLembaga()])]] + $this->aturanDasar();
    }
}
