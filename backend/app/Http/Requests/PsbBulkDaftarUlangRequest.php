<?php

namespace App\Http\Requests;

class PsbBulkDaftarUlangRequest extends PsbBulkRequest
{
    public function rules(): array
    {
        return $this->aturanIds() + [
            'lolos' => ['nullable', 'boolean'],
            'catatan' => ['nullable', 'string'],
        ];
    }
}
