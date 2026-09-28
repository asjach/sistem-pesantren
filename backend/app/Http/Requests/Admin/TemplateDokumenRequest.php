<?php

namespace App\Http\Requests\Admin;

use App\Models\TemplateDokumen;
use App\Services\Template\AsetGambar;
use App\Services\Template\DefinisiMedan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TemplateDokumenRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Izin dijaga middleware `permission:template_dokumen.tambah|ubah`.
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('template_dokumen');
        $id = $id instanceof TemplateDokumen ? $id->id : $id;

        return [
            'nama' => ['required', 'string', 'max:120'],
            'kode' => ['nullable', 'string', 'max:60', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/', Rule::unique('template_dokumen', 'kode')->ignore($id)],
            'kategori' => ['required', 'string', Rule::in(TemplateDokumen::KATEGORI)],
            'jenis' => [Rule::requiredIf($this->isMethod('post')), 'nullable', 'string', Rule::in(['pdf', 'html'])],
            'deskripsi' => ['nullable', 'string', 'max:1000'],
            'jenjang' => ['nullable', 'string', 'max:20', 'exists:lembaga,jenjang'],
            'aktif' => ['nullable', 'boolean'],
            'berkas' => ['nullable', 'file', 'mimes:pdf', 'max:'.AsetGambar::MAKS_UPLOAD_PDF],
            'definisi' => ['nullable', 'array'],
            'definisi.medan' => ['array', 'max:'.DefinisiMedan::BATAS_MEDAN],
        ];
    }

    public function messages(): array
    {
        return [
            'kategori.in' => 'Kategori template tidak dikenal.',
            'jenis.in' => 'Jenis template harus pdf atau html.',
            'kode.regex' => 'Kode template hanya boleh huruf kecil, angka, dan tanda hubung.',
            'kode.unique' => 'Kode template sudah dipakai.',
            'berkas.mimes' => 'Berkas template harus berupa PDF.',
            'berkas.max' => 'Ukuran berkas template maksimal 20 MB.',
            'definisi.medan.max' => 'Satu template maksimal '.DefinisiMedan::BATAS_MEDAN.' medan.',
        ];
    }

    public function attributes(): array
    {
        return [
            'nama' => 'nama template',
            'kategori' => 'kategori',
            'jenjang' => 'lembaga',
            'berkas' => 'berkas template',
        ];
    }
}
