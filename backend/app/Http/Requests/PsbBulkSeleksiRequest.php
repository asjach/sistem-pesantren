<?php

namespace App\Http\Requests;

class PsbBulkSeleksiRequest extends PsbBulkRequest
{
    public function rules(): array
    {
        return $this->aturanIds() + [
            'lolos' => ['required', 'boolean'],
            'catatan' => ['nullable', 'string'],
        ];
    }
}
