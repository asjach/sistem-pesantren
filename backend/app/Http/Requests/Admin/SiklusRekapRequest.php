<?php

namespace App\Http\Requests\Admin;

use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

class SiklusRekapRequest extends FormRequest
{
    /** Cermin authorize('viewAny', Santri::class) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('viewAny', Santri::class);
    }

    public function rules(): array
    {
        return [
            'lembaga_id' => ['nullable', 'integer', 'exists:lembaga,id'],
            'tahun_ajaran' => ['nullable', 'string', 'exists:tahun_ajaran,nama'],
        ];
    }
}
