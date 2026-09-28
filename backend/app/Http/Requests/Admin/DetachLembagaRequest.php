<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DetachLembagaRequest extends FormRequest
{
    public function authorize(): bool
    {
        $auth = $this->user();
        $target = $this->route('user');
        if (! $auth instanceof User || ! $target instanceof User) {
            return false;
        }
        if (! $auth->can('update', $target)) {
            return false;
        }

        return $target->bolehDimutasiOleh($auth);
    }

    public function rules(): array
    {
        return [
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            // Tanpa role = lepas semua baris jenjang itu; null eksplisit =
            // hanya baris warisan; string = hanya baris peran itu.
            'role' => ['sometimes', 'nullable', 'string', Rule::in(User::PERAN_LEMBAGA)],
        ];
    }
}
