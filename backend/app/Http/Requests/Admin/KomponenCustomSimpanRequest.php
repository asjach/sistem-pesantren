<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class KomponenCustomSimpanRequest extends FormRequest
{
    /** Setelan komponen custom diatur dari popover klik-kanan komponen (mis.
     *  tipe input), jadi semua pengguna terautentikasi boleh menulis — sama
     *  seperti ukuran kotak kontrol pada `toolbar_preset`. */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'table_key' => ['sometimes', 'string', 'max:60'],
            // `htmlFor` komponen: snake_case (NFR-05), maks 60.
            'komponen' => ['required', 'string', 'max:60', 'regex:/^[a-z0-9_]{1,60}$/'],
            // Peta setelan; kunci & nilainya dicek di controller agar pesan
            // galat menyebut kunci yang salah (mis. `setelan.tipeKontrol`).
            'setelan' => ['required', 'array', 'max:20'],
        ];
    }
}