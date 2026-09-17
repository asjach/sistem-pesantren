<?php

namespace App\Http\Requests\Admin;

class SantriUpdateRequest extends SantriProfilRequest
{
    /** Cermin authorize('update', $santri) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('update', $this->route('santri'));
    }

    public function rules(): array
    {
        return $this->aturanProfil();
    }
}
