<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Gerbang AKSI = izin matriks (`pengguna.*`); cakupan DATA = pivot.
     * Aturan struktural (target privileged, kunci diri) tetap di controller.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('pengguna.lihat');
    }

    public function view(User $user, User $target): bool
    {
        if (! $user->can('pengguna.lihat')) {
            return false;
        }
        if ($user->bolehPesantren()) {
            return true;
        }

        return $user->isSameTenant($target);
    }

    public function create(User $user): bool
    {
        return $user->can('pengguna.tambah');
    }

    public function update(User $user, User $target): bool
    {
        if (! $user->can('pengguna.ubah')) {
            return false;
        }

        return $this->view($user, $target);
    }

    public function delete(User $user, User $target): bool
    {
        if (! $user->can('pengguna.hapus')) {
            return false;
        }

        return $user->id !== $target->id && $this->view($user, $target);
    }
}
