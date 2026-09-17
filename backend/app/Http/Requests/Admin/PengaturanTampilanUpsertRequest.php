<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PengaturanTampilanUpsertRequest extends FormRequest
{
    /** Sebar standar = super_admin saja (Rekam Visual + API langsung ikut terkunci). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('super_admin');
    }

    public function rules(): array
    {
        return [
            'lembaga_ids' => ['required'],
            'data' => ['required', 'array'],
            'data.tema' => ['sometimes', 'array'],
            'data.tema.theme' => ['sometimes', 'nullable', 'string', 'max:40'],
            'data.tema.mode' => ['sometimes', 'nullable', Rule::in(['terang', 'gelap', 'sistem'])],
            'data.tema.warnaUI' => ['sometimes', 'nullable', Rule::in(['netral', 'aksen', 'kaya'])],
            'data.tema.iconSet' => ['sometimes', 'nullable', 'string', 'max:40'],
            'data.tema.density' => ['sometimes', 'nullable', Rule::in(['ramping', 'sedang', 'nyaman'])],
            'data.parts' => ['sometimes', 'array'],
            'data.parts.gaya' => ['sometimes', 'array'],
            'data.parts.terang' => ['sometimes', 'array'],
            'data.parts.gelap' => ['sometimes', 'array'],
            'data.grid' => ['sometimes', 'array'],
            'data.grid.rowH' => ['sometimes', 'nullable', 'integer', 'between:20,200'],
            'data.grid.headerH' => ['sometimes', 'nullable', 'integer', 'between:20,120'],
            'data.grid.align' => ['sometimes', 'array'],
            'data.grid.align.*' => [Rule::in(['left', 'center', 'right'])],
            'data.presetAktif' => ['sometimes', 'array'],
            'data.presetAktif.*' => ['nullable', 'string', 'max:50'],
            'data.lebar' => ['sometimes', 'array'],
            'data.lebar.*' => ['nullable', 'array'],
            'data.lebar.*.*' => ['integer', 'between:20,2000'],
            'data.beku' => ['sometimes', 'array'],
            'data.beku.*' => ['nullable', 'integer', 'between:0,20'],
            'sumber_lembaga_id' => ['sometimes', 'nullable', 'integer', 'exists:lembaga,id'],
        ];
    }
}
