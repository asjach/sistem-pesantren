<?php

namespace App\Http\Requests\Admin;

use App\Services\Template\AsetGambar;
use Illuminate\Foundation\Http\FormRequest;

class AsetDokumenRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Izin dijaga middleware `permission:template_dokumen.ubah`.
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => ['required', 'string', 'max:100'],
            'jenjang' => ['nullable', 'string', 'max:20', 'exists:lembaga,jenjang'],
            'berkas' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:'.AsetGambar::MAKS_UPLOAD_GAMBAR],
        ];
    }

    public function messages(): array
    {
        return [
            'berkas.mimes' => 'Aset harus berupa gambar JPG, PNG, atau WebP.',
            'berkas.max' => 'Ukuran aset maksimal 4 MB.',
            'nama.required' => 'Nama aset wajib diisi.',
        ];
    }

    public function attributes(): array
    {
        return [
            'nama' => 'nama aset',
            'berkas' => 'berkas aset',
        ];
    }
}
