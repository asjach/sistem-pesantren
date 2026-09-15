<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin']);
    }

    public function view(User $user, User $target): bool
    {
        if ($user->bolehPesantren()) {
            return true;
        }

        return $user->isSameTenant($target);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin']);
    }

    public function update(User $user, User $target): bool
    {
        return $this->view($user, $target);
    }

    public function delete(User $user, User $target): bool
    {
        return $user->id !== $target->id && $this->view($user, $target);
    }
}
