<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class PengaturanGlobalSimpanRequest extends FormRequest
{
    /** Hanya super_admin efektif yang boleh menetapkan standar global. */
    public function authorize(): bool
    {
        return $this->user()?->bolehSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'kunci' => ['required', 'string', 'max:60'],
            // Nilai bebas bentuk (angka/teks/bool); arti per kunci ada di
            // frontend. Server hanya menjaga bentuknya tetap JSON skalar.
            'nilai' => ['present', 'nullable'],
        ];
    }
}
