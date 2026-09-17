<?php

namespace App\Http\Requests\Admin;

use App\Models\Santri;

class SantriStoreRequest extends SantriProfilRequest
{
    /** Cermin authorize('create', Santri::class) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('create', Santri::class);
    }

    public function rules(): array
    {
        return [
            'nama_lengkap' => ['required', 'string', 'max:255'],
            'jk' => ['required', 'in:L,P'],
        ] + $this->aturanProfil();
    }
}
