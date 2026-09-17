<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LembagaSantriStoreRequest extends FormRequest
{
    /** Cermin authorize('update', $santri) controller (403 sebelum validasi). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('update', $this->route('santri'));
    }

    public function rules(): array
    {
        return [
            'lembaga_id' => ['required', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'nis_lokal' => ['nullable', 'string', 'max:20'],
            'tgl_mulai' => ['nullable', 'date'],
        ];
    }
}
