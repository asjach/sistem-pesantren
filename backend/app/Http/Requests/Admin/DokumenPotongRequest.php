<?php

namespace App\Http\Requests\Admin;

use App\Services\DokumenImporService;
use Illuminate\Foundation\Http\FormRequest;

class DokumenPotongRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Import daftar dokumen bertahap: potongan baris JSON (maks 1000/panggilan). */
    public function rules(): array
    {
        return [
            'sesi_id' => ['nullable', 'integer', 'exists:import_sesi,id'],
            'mode' => ['required', 'in:periksa,eksekusi'],
            'total' => ['required_without:sesi_id', 'integer', 'min:1', 'max:600000'],
            'baris' => ['required', 'array', 'min:1', 'max:1000'],
            'baris.*' => ['array'],
            'terakhir' => ['sometimes', 'boolean'],
        ];
    }

    /** Tipe dokumen dari path (santri|pegawai|lembaga) — divalidasi di sini. */
    public function tipe(): string
    {
        $tipe = (string) $this->route('tipe', '');
        if (! in_array($tipe, DokumenImporService::TIPE, true)) {
            abort(404);
        }

        return $tipe;
    }
}
