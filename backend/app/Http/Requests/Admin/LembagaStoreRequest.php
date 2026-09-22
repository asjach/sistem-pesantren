<?php

namespace App\Http\Requests\Admin;

class LembagaStoreRequest extends LembagaRequest
{
    public function rules(): array
    {
        return [
            'jenjang' => ['required', 'string', 'max:20', 'regex:/^[A-Z0-9]{1,20}$/', 'unique:lembaga,jenjang'],
            'nama' => ['required', 'string', 'max:100'],
        ] + $this->aturanDasar();
    }

    public function messages(): array
    {
        return ['jenjang.regex' => 'Jenjang harus huruf besar/angka, mis. MI, MD, MTS, MLN.'];
    }
}
