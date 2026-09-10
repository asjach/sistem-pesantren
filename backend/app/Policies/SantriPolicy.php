<?php

namespace App\Policies;

use App\Models\Santri;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SantriPolicy
{
    public function viewAny(User $user): bool
    {
        // Guru TIDAK ikut list admin (scopeTenantScope me-return 1=0 untuk guru);
        // guru akses santri via endpoint pengampu/walas (201/202), bukan /api/admin/santri.
        return $user->hasAnyRole(['super_admin', 'admin']);
    }

    public function view(User $user, Santri $santri): bool
    {
        if ($user->hasRole('super_admin') || $user->isAdminFull()) return true;
        // Wali: hanya anaknya sendiri
        if ($user->hasRole('orang_tua') && ! $this->isAnakWali($user, $santri)) return false;
        if ($user->hasRole('orang_tua')) return true;
        // Admin/guru/kasir: tenant lembaga (utama + pivot user_lembaga)
        return $user->canAccessLembaga((int) $santri->lembaga_id);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin']);
    }

    public function update(User $user, Santri $santri): bool
    {
        // Wali TIDAK boleh edit langsung — via pengajuan_biodata_santri (approve admin)
        if ($user->hasRole('orang_tua') && ! $user->hasAnyRole(['super_admin', 'admin'])) return false;
        return $this->view($user, $santri);
    }

    public function mutasi(User $user, Santri $santri): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin'])
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
