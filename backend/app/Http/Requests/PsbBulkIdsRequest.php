<?php

namespace App\Http\Requests;

class PsbBulkIdsRequest extends PsbBulkRequest
{
    public function rules(): array
    {
        return $this->aturanIds();
    }
}
