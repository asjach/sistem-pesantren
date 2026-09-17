<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Otorisasi update user dipindah ke authorize() agar tetap 403 SEBELUM
 * validasi 422 (FormRequest berjalan lebih dulu dari badan controller).
 * Aturan yang bergantung hasil validasi (mis. role di luar kewenangan)
 * tetap diperiksa di controller.
 */
class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        $auth = $this->user();
        $target = $this->route('user');
        if (! $auth instanceof User || ! $target instanceof User) {
            return false;
        }
        if (! $auth->isSameTenant($target)) {
            return false;
        }
        if (! $target->bolehDimutasiOleh($auth)) {
            return false;
        }
        if ($auth->id === $target->id && $this->exists('roles')) {
            return false;
        }
        if (! $auth->bolehSuperAdmin()) {
            $above = array_values(array_filter(array_diff(
                $target->roles->pluck('name')->all(),
                $auth->assignableRoles(),
                ['admin', 'super_admin']
            )));
            if (! empty($above)) {
                return false;
            }
        }

        return true;
    }

    public function rules(): array
    {
        $id = $this->route('user')->id;

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'unique:users,email,'.$id],
            'phone' => ['nullable', 'string', 'max:20', 'unique:users,phone,'.$id],
            'username' => ['nullable', 'string', 'max:50', 'unique:users,username,'.$id],
            'password' => ['nullable', 'string', 'min:8'],
            'lembaga_ids' => ['nullable', 'array'],
            'lembaga_ids.*' => ['integer', 'exists:lembaga,id'],
            'roles' => ['sometimes', 'array', 'min:1'],
            'roles.*' => ['string', 'exists:roles,name,guard_name,sanctum'],
        ];
    }
}
