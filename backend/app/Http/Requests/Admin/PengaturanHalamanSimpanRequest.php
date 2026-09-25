<?php

namespace App\Http\Requests\Admin;

use App\Http\Controllers\Api\Admin\PengaturanHalamanController;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PengaturanHalamanSimpanRequest extends FormRequest
{
    /** Filter halaman hanya dikelola super_admin (403 sebelum validasi). */
    public function authorize(): bool
    {
        return $this->user()?->bolehSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'page_key' => ['required', 'string', 'max:60'],
            'filter' => ['sometimes', 'array', 'max:20'],
            'filter.*' => ['boolean'],
            'filter_mode' => [
                'sometimes',
                'array:'.implode(',', PengaturanHalamanController::KUNCI),
                'max:5',
            ],
            'filter_mode.*' => [
                'required',
                'string',
                Rule::in(PengaturanHalamanController::MODE_FILTER),
            ],
        ];
    }
}
