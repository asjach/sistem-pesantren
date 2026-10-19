<?php

namespace App\Policies;

use App\Models\Santri;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SantriPolicy
{
    /**
     * Gerbang AKSI = izin matriks; cakupan DATA = pivot (bolehPesantren/canAccessLembaga).
     * Pengecualian portal (orang_tua) tetap role-based di cabang wali.
     */
    public function viewAny(User $user): bool
    {

        return $user->can('santri.lihat');
    }

    public function view(User $user, Santri $santri): bool
    {
        if (! $user->can('santri.lihat')) {
            return false;
        }
        if ($user->bolehPesantren()) {
            return true;
        }

        if ($user->hasRole('orang_tua') && ! $this->isAnakWali($user, $santri)) {
            return false;
        }
        if ($user->hasRole('orang_tua')) {
            return true;
        }

        $lembagaIds = $santri->lembagaSantri()->pluck('jenjang');
        if ($lembagaIds->isEmpty()) {
            return true;
        }

        return $lembagaIds->contains(fn ($id) => $user->canAccessLembaga($id));
    }

    public function create(User $user): bool
    {
        return $user->can('santri.tambah');
    }

    public function update(User $user, Santri $santri): bool
    {

        if ($user->hasRole('orang_tua') && ! $user->can('santri.ubah')) {
            return false;
        }
        if (! $user->can('santri.ubah')) {
            return false;
        }

        return $this->view($user, $santri);
    }

    public function mutasi(User $user, Santri $santri): bool
    {
        return $user->can('santri.ubah')
            && $this->view($user, $santri);
    }

    protected function isAnakWali(User $user, Santri $santri): bool
    {
        return DB::table('wali_santri_relasi')
            ->where('user_id', $user->id)
            ->where('santri_id', $santri->id)
            ->where('is_active', true)
            ->exists();
    }
}
