<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Aturan bersama aksi massal PSB: daftar id calon. */
abstract class PsbBulkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function aturanIds(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer', 'distinct'],
        ];
    }
}
