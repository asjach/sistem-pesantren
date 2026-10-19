<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Validasi formulir tambah tarif tagihan. */
class TarifStoreRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $jenjang = $this->input('jenjang');

        $berwenang = is_string($jenjang) && (bool) $this->user()?->canAccessLembaga($jenjang);

        return [
            'jenjang' => 'required|string',
            'tahun_ajaran' => 'required|string|max:9',

            'jenis_id' => [
                'required', 'integer', 'exists:jenis_tagihan,id',
                ...($berwenang ? [
                    Rule::unique('tarif_tagihan', 'jenis_id')
                        ->where(fn ($q) => $q
                            ->where('jenjang', $jenjang)
                            ->where('tahun_ajaran', $this->input('tahun_ajaran'))),
                ] : []),
            ],
            'tingkat' => 'nullable|string|max:100',
            'nominal' => 'required|integer|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'jenis_id.unique' => 'Tarif untuk lembaga + tahun ajaran + jenis ini sudah ada — ubah baris yang ada, bukan menambah tarif baru.',
        ];
    }
}
