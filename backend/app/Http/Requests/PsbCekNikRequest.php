<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PsbCekNikRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nik' => ['required', 'digits:16'],
        ];
    }
}
