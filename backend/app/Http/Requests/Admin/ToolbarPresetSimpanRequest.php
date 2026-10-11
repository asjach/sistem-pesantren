<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ToolbarPresetSimpanRequest extends FormRequest
{
    /** Ukuran (lebar/tinggi) kotak kontrol toolbar kini diatur dari popover
     *  klik-kanan combobox, jadi semua pengguna terautentikasi boleh menulis.
     *  Visibilitas/urutan/align tetap khusus super_admin — dicek di controller
     *  (butuh data ter-validasi, jadi tidak bisa di sini). */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'table_key' => ['required', 'string', 'max:60'],
            'visibilitas' => ['sometimes', 'array', 'max:20'],
            'visibilitas.*' => ['boolean'],
            'lebar' => ['sometimes', 'array', 'max:60'],
            // Batas atas disamakan dengan popover (LEBAR_KOMBO_MAKS = 1200):
            // combobox yang membentang penuh bisa jauh di atas 480px.
            // Batas bawah longgar (min 0): rentang per jenis kunci (total /
            // label / kontrol / penanda) ditegakkan di controller agar kunci
            // galatnya tetap `lebar.<kunci>`.
            'lebar.*' => ['integer', 'min:0', 'max:1200'],
            'tinggi' => ['sometimes', 'array', 'max:60'],
            'tinggi.*' => ['integer', 'min:20', 'max:120'],
            'urutan' => ['sometimes', 'array', 'max:300'],
            'urutan.*' => ['string', 'max:80', 'regex:/^[a-z0-9_]{1,80}$/'],
            'align' => ['sometimes', 'array', 'max:200'],
            'align.*' => ['string', Rule::in(['left', 'center', 'right'])],
        ];
    }
}
