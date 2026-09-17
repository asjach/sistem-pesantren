<?php

namespace App\Http\Requests\Admin;

class LembagaStoreRequest extends LembagaRequest
{
    public function rules(): array
    {
        return ['nama' => ['required', 'string', 'max:100']] + $this->aturanDasar();
    }
}
