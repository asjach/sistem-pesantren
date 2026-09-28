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

        $buat = $this->isMethod('post');

        return [
            'nama' => ['required', 'string', 'max:120'],
            'kode' => ['nullable', 'string', 'max:60', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/', Rule::unique('template_dokumen', 'kode')->ignore($id)],
            // Kategori wajib saat membuat, boleh absen saat PATCH. Aturan
            // `sometimes` tidak boleh dipakai bersama `required` karena
            // `sometimes` membuat wajib dilewati ketika kunci tidak dikirim,
            // sehingga POST tanpa kategori lolos validasi lalu ditolak
            // constraint CHECK di basis data dan menjawab 500.
            //
            // Aturan PATCH dibuat nullable, sementara controller hanya menimpa
            // kolom yang benar-benar dikirim sehingga kategori tidak terisi
            // string kosong.
            'kategori' => $buat
                ? ['required', 'string', Rule::in(TemplateDokumen::KATEGORI)]
                : ['nullable', 'string', Rule::in(TemplateDokumen::KATEGORI)],
            'jenis' => $buat
                ? ['required', 'string', Rule::in(['pdf', 'html'])]
                : ['nullable', 'string', Rule::in(['pdf', 'html'])],
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
            'nama.required' => 'Nama template wajib diisi.',
            'kategori.required' => 'Kategori template wajib dipilih.',
            'kategori.in' => 'Kategori template tidak dikenal.',
            'jenis.required' => 'Jenis template wajib dipilih.',
            'jenis.in' => 'Jenis template harus pdf atau html.',
            'kode.regex' => 'Kode template hanya boleh huruf kecil, angka, dan tanda hubung.',
            'kode.unique' => 'Kode template sudah dipakai.',
            'nama.max' => 'Nama template maksimal 120 karakter.',
            'deskripsi.max' => 'Deskripsi maksimal 1000 karakter.',
            'jenjang.exists' => 'Lembaga yang dipilih tidak ditemukan.',
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
