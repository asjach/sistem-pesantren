<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Helper tenant untuk controller admin.
 * Single-tenant: tenant = lembaga (kunci `jenjang`) via pivot user_lembaga (003).
 * List boleh lebar se-pesantren (= semua lembaga yang boleh diakses); aksi ketat AND per-lembaga.
 */
trait TenantGuard
{
    use PerPageLimit;

    protected function authorizeLembaga(User $auth, string $jenjang): void
    {
        if (! $auth->canAccessLembaga($jenjang)) {
            abort(403, 'Akses ditolak.');
        }
    }

    /**
     * Batasi query ke lembaga yang boleh diakses auth user.
     * super_admin / admin full: semua (opsional filter `jenjang`).
     * Lainnya: whereIn lembagaIds() (pivot user_lembaga).
     */
    protected function scopeLembaga($query, User $auth, Request $request, string $column = 'jenjang')
    {
        if ($auth->bolehPesantren()) {
            if ($request->filled('jenjang')) {
                $query->where($column, $request->input('jenjang'));
            }

            return $query;
        }

        $ids = $auth->lembagaIdsDenganPasangan();
        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }
        if ($request->filled('jenjang')) {
            $this->authorizeLembaga($auth, (string) $request->input('jenjang'));

            return $query->where($column, $request->input('jenjang'));
        }

        return $query->whereIn($column, $ids);
    }

    /**
     * Batasi query lewat relasi detail lembaga (mis. psb_calon_lembaga):
     * admin MD melihat calon satuan MD + calon paket MI-MD (punya baris anak MD).
     */
    protected function scopeLembagaRelasi($query, User $auth, Request $request, string $relation = 'lembagaDetail')
    {
        $filter = fn ($q) => $q->where('jenjang', $request->input('jenjang'));

        if ($auth->bolehPesantren()) {
            if ($request->filled('jenjang')) {
                $query->whereHas($relation, $filter);
            }

            return $query;
        }

        $ids = $auth->lembagaIdsDenganPasangan();
        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }
        if ($request->filled('jenjang')) {
            $this->authorizeLembaga($auth, (string) $request->input('jenjang'));

            return $query->whereHas($relation, $filter);
        }

        return $query->whereHas($relation, fn ($q) => $q->whereIn('jenjang', $ids));
    }

    /**
     * Aksi siklus per lembaga: admin scoped wajib punya riwayat aktif santri
     * di lembaga target (aksi ketat AND per-lembaga).
     */
    protected function authorizeAksiLembaga(Request $request, Santri $santri, string $target): void
    {
        $this->authorizeLembaga($request->user(), $target);
        $auth = $request->user();
        if ($auth->bolehPesantren()) {
            return;
        }
        $punya = RiwayatBelajar::where('santri_id', $santri->id)
            ->where('jenjang', $target)
            ->where('is_active_riwayat', RiwayatBelajar::YA)
            ->exists();
        if (! $punya) {
            abort(403, 'Akses ditolak.');
        }
    }

    /** TA wajib berlaku untuk lembaga target (TA global dikurangi yang disembunyikan). */
    protected function cekTaEfektif(string $jenjang, string $ta, string $field = 'tahun_ajaran'): void
    {
        if (! TahunAjaran::efektif($jenjang)->contains('nama', $ta)) {
            throw ValidationException::withMessages([$field => 'Tahun ajaran tidak berlaku untuk lembaga ini.']);
        }
    }
}
