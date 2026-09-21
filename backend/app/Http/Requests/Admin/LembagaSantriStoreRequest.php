<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LembagaSantriStoreRequest extends FormRequest
{
    /** Cermin authorize('update', $santri) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('update', $this->route('santri'));
    }

    public function rules(): array
    {
        return [
            'lembaga_id' => ['required', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'nis_lokal' => ['nullable', 'string', 'max:20'],
            'nis_kemenag' => ['nullable', 'string', 'max:20'],
            'tahaj_masuk' => ['nullable', 'string', 'max:50'],
            'tingkat_masuk' => ['nullable', 'string', 'max:20'],
            'no_urut' => ['nullable', 'integer', 'min:0'],
            'nama_sekolah_asal' => ['nullable', 'string', 'max:255'],
            'npsn_sekolah_asal' => ['nullable', 'string', 'max:20'],
            'nss_sekolah_asal' => ['nullable', 'string', 'max:30'],
            'alamat_sekolah_asal' => ['nullable', 'string', 'max:500'],
            'is_active_lembaga' => ['sometimes', Rule::in(['Ya', 'Tidak'])],
            'tgl_masuk' => ['nullable', 'date'],
            'tgl_selesai' => ['nullable', 'date'],
        ];
    }
}
