<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PengaturanHalamanSimpanRequest extends FormRequest
{
    /** Filter halaman hanya dikelola super_admin (403 sebelum validasi). */
    public function authorize(): bool
    {
        return $this->user()?->bolehSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'page_key' => ['required', 'string', 'max:60'],
            'filter' => ['sometimes', 'array', 'max:20'],
            'filter.*' => ['boolean'],
        ];
    }
}
