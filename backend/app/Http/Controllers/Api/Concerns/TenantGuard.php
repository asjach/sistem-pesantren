<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Helper tenant untuk controller admin.
 * Single-tenant: tenant = lembaga via pivot user_lembaga (003).
 * List boleh lebar se-pesantren (= semua lembaga yang boleh diakses); aksi ketat AND per-lembaga.
 */
trait TenantGuard
{
    protected function perPage(Request $request): int
    {
        return max(1, min((int) $request->input('per_page', 20), 100));
    }

    protected function authorizeLembaga(User $auth, int $lembagaId): void
    {
        if (! $auth->canAccessLembaga($lembagaId)) {
            abort(403, 'Akses ditolak.');
        }
    }

    /**
     * Batasi query ke lembaga yang boleh diakses auth user.
     * super_admin / admin full: semua (opsional filter lembaga_id).
     * Lainnya: whereIn lembagaIds() (pivot user_lembaga).
     */
    protected function scopeLembaga($query, User $auth, Request $request, string $column = 'lembaga_id')
    {
        if ($auth->hasRole('super_admin') || $auth->isAdminFull()) {
            if ($request->filled('lembaga_id')) {
                $query->where($column, $request->input('lembaga_id'));
            }
            return $query;
        }

        $ids = $auth->lembagaIds();
        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }
        if ($request->filled('lembaga_id')) {
            $this->authorizeLembaga($auth, (int) $request->input('lembaga_id'));
            return $query->where($column, $request->input('lembaga_id'));
        }

        return $query->whereIn($column, $ids);
    }
}
