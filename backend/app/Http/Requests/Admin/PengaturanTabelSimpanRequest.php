<?php

namespace App\Http\Requests\Admin;

use App\Http\Controllers\Api\Admin\PengaturanTabelController;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PengaturanTabelSimpanRequest extends FormRequest
{
    /** Filter tabel hanya dikelola super_admin (403 sebelum validasi). */
    public function authorize(): bool
    {
        return $this->user()?->bolehSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'table_key' => ['required', 'string', 'max:60'],
            'filter' => ['sometimes', 'array', 'max:20'],
            'filter.*' => ['boolean'],
            'filter_mode' => [
                'sometimes',
                'array:'.implode(',', PengaturanTabelController::KUNCI),
                'max:5',
            ],
            'filter_mode.*' => [
                'required',
                'string',
                Rule::in(PengaturanTabelController::MODE_FILTER),
            ],
        ];
    }
}
