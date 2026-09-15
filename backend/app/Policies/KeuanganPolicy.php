<?php

namespace App\Policies;

use App\Models\Pembayaran;
use App\Models\Tagihan;
use App\Models\User;

class KeuanganPolicy
{
    // Kasir mobile: input (lihat + bayar) boleh; ubah/hapus HANYA admin.
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin', 'kasir']);
    }

    public function view(User $user, Tagihan $tagihan): bool
    {
        // Tagihan punya lembaga_id sendiri (diisi santri primer / calon.lembaga / paket=primer).
        if ($user->bolehPesantren()) {
            return true;
        }
        if (! $tagihan->lembaga_id) {
            return false;
        }

        return $user->canAccessLembaga((int) $tagihan->lembaga_id);
    }

    public function bayar(User $user, Tagihan $tagihan): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin', 'kasir'])
            && $this->view($user, $tagihan);
    }

    public function update(User $user, Pembayaran $pembayaran): bool
    {
        // Koreksi/void pembayaran: admin saja (kasir tidak boleh ubah/hapus)
        return $user->hasAnyRole(['super_admin', 'admin'])
            && $this->viewPembayaran($user, $pembayaran);
    }

    public function delete(User $user, Pembayaran $pembayaran): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin'])
            && $this->viewPembayaran($user, $pembayaran);
    }

    protected function viewPembayaran(User $user, Pembayaran $pembayaran): bool
    {
        if ($user->bolehPesantren()) {
            return true;
        }
        $pembayaran->loadMissing('detail.tagihan');
        $lembagaIds = $pembayaran->detail
            ->map(fn ($d) => $d->tagihan?->lembaga_id)
            ->filter()
            ->unique();

        if ($lembagaIds->isEmpty()) {
            return false;
        }

        foreach ($lembagaIds as $lembagaId) {
            if (! $user->canAccessLembaga((int) $lembagaId)) {
                return false;
            }
        }

        return true;
    }
}
