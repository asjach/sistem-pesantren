<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Validasi formulir catat pembayaran tagihan. */
class PembayaranStoreRequest extends FormRequest
{
    /** Pemeriksaan izin & lingkup lembaga tetap di controller (perilaku lama). */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tagihan_id' => 'required|integer|exists:tagihan,id',
            'jumlah' => 'required|integer|min:1',
            'metode' => 'in:tunai,transfer',
            'kas' => 'in:tunai_tu,bank_lembaga,bank_pesantren',
            'no_kwitansi' => 'nullable|string|max:60|unique:pembayaran,no_kwitansi',
            'catatan' => 'nullable|string|max:190',
        ];
    }
}
