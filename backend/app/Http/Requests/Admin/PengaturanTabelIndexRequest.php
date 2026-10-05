<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PengaturanTabelIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'keys' => ['required', 'array', 'min:1', 'max:50'],
            'keys.*' => ['required', 'string', 'max:60', 'distinct'],
        ];
    }
}
