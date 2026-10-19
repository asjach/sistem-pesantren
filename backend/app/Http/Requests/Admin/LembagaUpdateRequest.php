<?php

namespace App\Http\Requests\Admin;

use Illuminate\Validation\Rule;

class LembagaUpdateRequest extends LembagaRequest
{
    public function rules(): array
    {

        return ['jenjang' => ['sometimes', 'string', Rule::in([$this->jenjangLembaga()])]] + $this->aturanDasar();
    }
}
