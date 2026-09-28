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
        $id = $this->templateDipakai()?->id;

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
            // Jumlah dan ukuran halaman hanya boleh diubah untuk template
            // jenis 'html'. Template 'pdf' mengikuti ukuran halaman berkasnya
            // sendiri, jadi writablean di sini akan bertentangan dengan
            // FPDI yang membacanya ulang setiap kali dicetak.
            'jumlah_halaman' => [
                'nullable', 'integer', 'min:1', 'max:'.self::MAKS_HALAMAN,
                Rule::prohibitedIf($this->jenisTemplate() === TemplateDokumen::JENIS_PDF),
            ],
            'halaman' => [
                'nullable', 'array', 'max:'.self::MAKS_HALAMAN,
                Rule::prohibitedIf($this->jenisTemplate() === TemplateDokumen::JENIS_PDF),
            ],
            'halaman.*.lebar_mm' => ['required', 'numeric', 'min:50', 'max:600'],
            'halaman.*.tinggi_mm' => ['required', 'numeric', 'min:50', 'max:600'],
            'definisi' => ['nullable', 'array'],
            'definisi.medan' => ['array', 'max:'.DefinisiMedan::BATAS_MEDAN],
        ];
    }

    /** Batas halaman yang masih wajar untuk dipratinjau dan dicetak. */
    public const MAKS_HALAMAN = 50;

    /**
     * Template yang sedang diubah, atau null saat membuat.
     *
     * Nama parameter rutenya `{template}`. Setelah SubstituteBindings, nilainya
     * sudah berupa model. Membaca nama yang keliru membuat validateUnique
     * mengabaikan dirinya sendiri, sehingga template tidak bisa disimpan tanpa
     * mengganti kode.
     */
    private function templateDipakai(): ?TemplateDokumen
    {
        $template = $this->route('template') ?? $this->route('template_dokumen');

        return $template instanceof TemplateDokumen ? $template : null;
    }

    /**
     * Jenis template yang sedang dealt.
     *
     * Saat PATCH jenis biasanya tidak ikut dikirim, jadi jenis dari model
     * yang dipakai, bukan dari badan permintaan.
     */
    private function jenisTemplate(): ?string
    {
        $dariBadan = $this->input('jenis');

        if (is_string($dariBadan) && $dariBadan !== '') {
            return $dariBadan;
        }

        return $this->templateDipakai()?->jenis;
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
            'jumlah_halaman.integer' => 'Jumlah halaman harus berupa angka.',
            'jumlah_halaman.min' => 'Jumlah halaman minimal 1 halaman.',
            'jumlah_halaman.max' => 'Jumlah halaman maksimal '.self::MAKS_HALAMAN.' halaman.',
            'jumlah_halaman.prohibited' => 'Jumlah halaman hanya bisa diubah pada template HTML.',
            'halaman.prohibited' => 'Ukuran halaman hanya bisa diubah pada template HTML.',
            'halaman.max' => 'Jumlah halaman maksimal '.self::MAKS_HALAMAN.' halaman.',
            'halaman.*.lebar_mm.required' => 'Lebar halaman wajib diisi.',
            'halaman.*.tinggi_mm.required' => 'Tinggi halaman wajib diisi.',
            'halaman.*.lebar_mm.min' => 'Lebar halaman minimal 50 mm.',
            'halaman.*.tinggi_mm.min' => 'Tinggi halaman minimal 50 mm.',
            'halaman.*.lebar_mm.max' => 'Lebar halaman maksimal 600 mm.',
            'halaman.*.tinggi_mm.max' => 'Tinggi halaman maksimal 600 mm.',
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
