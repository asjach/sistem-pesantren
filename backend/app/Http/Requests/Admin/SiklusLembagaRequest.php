<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Payload minimum siklus yang hanya butuh jenjang (tidak lulus / berhenti jenjang). */
class SiklusLembagaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jenjang' => 'required|exists:lembaga,jenjang',
        ];
    }
}
