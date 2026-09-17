<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class AttachLembagaRequest extends FormRequest
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
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
        ];
    }
}
