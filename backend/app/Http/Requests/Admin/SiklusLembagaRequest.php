<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Payload minimum siklus yang hanya butuh jenjang (tidak lulus / berhenti jenjang). */
class SiklusLembagaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'jenjang' => 'required|exists:lembaga,jenjang',
            'tahun_ajaran' => 'nullable|exists:tahun_ajaran,nama',
            'tingkat' => 'nullable|array',
            'tingkat.*' => 'nullable|string|max:20',
            'kelas_id' => 'nullable|array',
            'kelas_id.*' => 'nullable|integer|exists:kelas,id',
            'q' => 'nullable|string|max:100',
        ];
    }
}
