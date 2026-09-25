<?php

namespace App\Http\Requests\Admin;

use App\Http\Controllers\Api\Concerns\FilterGlobal;
use App\Models\Santri;
use Illuminate\Foundation\Http\FormRequest;

class SiklusRekapRequest extends FormRequest
{
    use FilterGlobal;

    protected function prepareForValidation(): void
    {
        $this->merge($this->normalisasiFilterInputs([
            'jenjang',
            'tahun_ajaran',
            'semester',
            'tingkat',
            'kelas_id',
        ]));
    }

    /** Cermin authorize('viewAny', Santri::class) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('viewAny', Santri::class);
    }

    public function rules(): array
    {
        return [
            'jenjang' => ['nullable', 'array'],
            'jenjang.*' => ['string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['nullable', 'array'],
            'tahun_ajaran.*' => ['string', 'exists:tahun_ajaran,nama'],
            'semester' => ['nullable', 'array'],
            'semester.*' => ['in:1,2'],
            'tingkat' => ['nullable', 'array'],
            'tingkat.*' => ['string'],
            'kelas_id' => ['nullable', 'array'],
            'kelas_id.*' => ['integer', 'exists:kelas,id'],
            'keaktifan' => ['nullable', 'in:aktif,nonaktif'],
        ];
    }
}
