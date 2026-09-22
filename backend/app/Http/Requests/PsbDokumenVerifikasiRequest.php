<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PsbDokumenVerifikasiRequest extends FormRequest
{
    /** Cermin authorizeLembaga controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        $dokumen = $this->route('dokumen');
        if ($dokumen === null) {
            return false;
        }
        $dokumen->load(['calon:id,jenjang', 'santri:id,jenjang']);
        $lembagaId = $dokumen->calon?->jenjang ?? $dokumen->santri?->jenjang;

        return $lembagaId !== null && (bool) $this->user()?->canAccessLembaga($lembagaId);
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:menunggu,valid,ditolak'],
            'catatan' => ['nullable', 'string'],
        ];
    }
}
