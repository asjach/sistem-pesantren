<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PengaturanHalamanHapusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->bolehSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'page_key' => ['required', 'string', 'max:60'],
        ];
    }
}
