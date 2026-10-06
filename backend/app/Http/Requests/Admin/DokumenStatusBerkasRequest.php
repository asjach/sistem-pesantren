<?php

namespace App\Http\Requests\Admin;

use App\Services\DokumenImporService;
use Illuminate\Foundation\Http\FormRequest;

/** Validasi batch status berkas dokumen (maks 100 nama per panggilan). */
class DokumenStatusBerkasRequest extends FormRequest
{
    /** Pemeriksaan izin tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    /** Tipe pada path dicek lebih dulu (404) agar tetap seperti cekTipe() controller. */
    protected function prepareForValidation(): void
    {
        $tipe = (string) $this->route('tipe', '');
        if (! in_array($tipe, DokumenImporService::TIPE, true)) {
            abort(404);
        }
    }

    public function rules(): array
    {
        return [
            'nama' => ['required', 'array', 'max:100'],
            'nama.*' => ['required', 'string', 'max:255'],
        ];
    }
}
