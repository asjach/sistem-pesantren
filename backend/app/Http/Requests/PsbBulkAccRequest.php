<?php

namespace App\Http\Requests;

class PsbBulkAccRequest extends PsbBulkRequest
{
    public function rules(): array
    {
        return $this->aturanIds() + [
            'nis' => ['nullable', 'array'],
            'nis.*' => ['nullable', 'string', 'max:20'],
        ];
    }
}
