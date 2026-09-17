<?php

namespace App\Http\Requests;

class PsbBulkCatatanRequest extends PsbBulkRequest
{
    public function rules(): array
    {
        return $this->aturanIds() + [
            'catatan' => ['nullable', 'string'],
        ];
    }
}
