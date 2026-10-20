<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DesainKartuPesertaRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $elemen = $this->input('elemen');
        if (is_string($elemen)) {
            $hasil = json_decode($elemen, true);
            if (is_array($hasil)) {
                $this->merge(['elemen' => $hasil]);
            }
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'id' => ['nullable', 'integer', 'exists:desain_kartu_peserta,id'],
            'peristiwa_id' => ['required', 'integer', 'exists:peristiwa_nilai,id'],
            'nama' => ['required', 'string', 'max:100'],
            'warna_latar' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'gaya_latar' => ['required', Rule::in(['klasik', 'modern', 'bersih', 'foto'])],
            'elemen' => ['required', 'array', 'min:1', 'max:30'],
            'elemen.*.id' => ['required', 'string', 'max:80'],
            'elemen.*.tipe' => ['required', Rule::in(['data', 'teks', 'foto'])],
            'elemen.*.field' => ['nullable', Rule::in([
                'nama', 'nomor_peserta', 'nis_lokal', 'kelas', 'tingkat',
                'peristiwa', 'tahun_ajaran', 'semester', 'lembaga',
            ])],
            'elemen.*.teks' => ['nullable', 'string', 'max:200'],
            'elemen.*.x' => ['required', 'numeric', 'min:0', 'max:100'],
            'elemen.*.y' => ['required', 'numeric', 'min:0', 'max:100'],
            'elemen.*.lebar' => ['required', 'numeric', 'min:5', 'max:100'],
            'elemen.*.tinggi' => ['required', 'numeric', 'min:5', 'max:100'],
            'elemen.*.ukuran_font' => ['required', 'numeric', 'min:6', 'max:48'],
            'elemen.*.warna' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'elemen.*.tebal' => ['required', 'boolean'],
            'elemen.*.rata' => ['required', Rule::in(['left', 'center', 'right'])],
            'latar' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120', 'dimensions:max_width=4000,max_height=4000'],
            'hapus_latar' => ['sometimes', 'boolean'],
        ];
    }
}
