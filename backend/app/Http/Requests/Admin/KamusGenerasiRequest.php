<?php

namespace App\Http\Requests\Admin;

use App\Http\Controllers\Api\Admin\KamusLabelController;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class KamusGenerasiRequest extends FormRequest
{
    /** Kamus label hanya dikelola admin pesantren (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->bolehPesantren();
    }

    public function rules(): array
    {
        return [
            'mode' => ['required', Rule::in(KamusLabelController::MODE_LABEL)],
        ];
    }
}
