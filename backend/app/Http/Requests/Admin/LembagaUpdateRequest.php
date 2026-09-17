<?php

namespace App\Http\Requests\Admin;

class LembagaUpdateRequest extends LembagaRequest
{
    public function rules(): array
    {
        return $this->aturanDasar();
    }
}
