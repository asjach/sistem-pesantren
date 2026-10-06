<?php

namespace App\Http\Requests\Admin;

use App\Services\DokumenImporService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi formulir tambah dokumen. Aturan pemilik mengikuti tipe pada path
 * (santri|pegawai|lembaga); tipe tak dikenal tetap 404 sebelum validasi.
 */
class DokumenStoreRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tipe = $this->tipePemilik();
        $aturanPemilik = match ($tipe) {
            'santri' => ['required', 'integer', 'exists:santri,id'],
            'pegawai' => ['required', 'integer', 'exists:pegawai,id'],
            'lembaga' => ['required', 'string', 'exists:lembaga,jenjang'],
        };

        return [
            'santri_id' => $tipe === 'santri' ? $aturanPemilik : ['prohibited'],
            'pegawai_id' => $tipe === 'pegawai' ? $aturanPemilik : ['prohibited'],
            'jenjang' => $tipe === 'lembaga' ? $aturanPemilik : ($tipe === 'pegawai' ? ['required', 'string', 'exists:lembaga,jenjang'] : ['nullable', 'string']),
            'jenis_dokumen' => ['required', 'string', 'max:100'],
            // Kolom status hanya tersisa di tabel lembaga.
            'status_verifikasi' => $tipe === 'lembaga' ? ['sometimes', 'in:menunggu,valid,ditolak'] : ['prohibited'],
            // Konteks lembaga pemakaian hanya ada di tabel santri.
            'lembaga' => $tipe === 'santri' ? ['sometimes', 'nullable', 'string', 'exists:lembaga,jenjang'] : ['prohibited'],
            'catatan' => ['nullable', 'string'],
            // Pegawai bebas semua jenis berkas; santri/lembaga tetap gambar/PDF.
            'file' => $tipe === 'pegawai'
                ? ['nullable', 'file', 'max:10240']
                : ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240'],
            // Simpanan lokal/test (dev): tanpa byte, nama dicadangkan untuk arsip perangkat.
            'tujuan' => ['sometimes', 'in:server,lokal,test'],
            'ekstensi' => ['sometimes', 'nullable', 'string', 'regex:/^[a-z0-9]{2,5}$/'],
        ];
    }

    /** Tipe pemilik dari path; 404 sebelum validasi seperti cekTipe() controller. */
    private function tipePemilik(): string
    {
        $tipe = (string) $this->route('tipe', '');
        if (! in_array($tipe, DokumenImporService::TIPE, true)) {
            abort(404);
        }

        return $tipe;
    }
}
