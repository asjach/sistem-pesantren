<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class CreateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'lembaga_ids' => ['nullable', 'array'],
            'lembaga_ids.*' => ['integer', 'exists:lembaga,id'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'required_without_all:phone,username', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20', 'unique:users,phone'],
            'username' => ['nullable', 'string', 'max:50', 'unique:users,username'],
            'password' => ['required', 'string', 'min:8'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['string', 'exists:roles,name,guard_name,sanctum'],
        ];
    }
}
