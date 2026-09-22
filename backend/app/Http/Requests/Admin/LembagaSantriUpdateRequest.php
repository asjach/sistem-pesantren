<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LembagaSantriUpdateRequest extends FormRequest
{
    /** Cermin authorizeLembaga controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        $row = $this->route('lembagaSantri');

        return $row !== null && (bool) $this->user()?->canAccessLembaga($row->jenjang);
    }

    public function rules(): array
    {
        return [
            'nis_lokal' => ['sometimes', 'nullable', 'string', 'max:20'],
            'nis_kemenag' => ['sometimes', 'nullable', 'string', 'max:20'],
            'tahaj_masuk' => ['sometimes', 'nullable', 'string', 'max:50'],
            'tingkat_masuk' => ['sometimes', 'nullable', 'string', 'max:20'],
            'no_urut' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'nama_sekolah_asal' => ['sometimes', 'nullable', 'string', 'max:255'],
            'npsn_sekolah_asal' => ['sometimes', 'nullable', 'string', 'max:20'],
            'nss_sekolah_asal' => ['sometimes', 'nullable', 'string', 'max:30'],
            'alamat_sekolah_asal' => ['sometimes', 'nullable', 'string', 'max:500'],
            'is_active_lembaga' => ['sometimes', Rule::in(['Ya', 'Tidak'])],
            'tgl_masuk' => ['sometimes', 'nullable', 'date'],
            'tgl_selesai' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
