<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PengaturanHalamanSimpanRequest extends FormRequest
{
    /** Hanya super_admin efektif yang boleh mengubah urutan tab. */
    public function authorize(): bool
    {
        return $this->user()?->bolehSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'page_key' => ['required', 'string', 'max:60'],
            'urutan' => ['present', 'array', 'max:50'],
            'urutan.*' => ['required', 'string', 'max:120', 'distinct'],
            'sembunyi' => ['present', 'array', 'max:50'],
            'sembunyi.*' => ['required', 'string', 'max:120', 'distinct'],
        ];
    }
}
