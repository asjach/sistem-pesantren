<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Lembaga;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Helper tenant untuk controller admin.
 * Single-tenant: tenant = lembaga via pivot user_lembaga (003).
 * List boleh lebar se-pesantren (= semua lembaga yang boleh diakses); aksi ketat AND per-lembaga.
 */
trait TenantGuard
{
    use PerPageLimit;

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
        if ($auth->bolehPesantren()) {
            if ($request->filled('lembaga_id')) {
                $query->where($column, $request->input('lembaga_id'));
            }

            return $query;
        }

        $ids = $auth->lembagaIdsDenganPasangan();
        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }
        if ($request->filled('lembaga_id')) {
            $this->authorizeLembaga($auth, (int) $request->input('lembaga_id'));

            return $query->where($column, $request->input('lembaga_id'));
        }

        return $query->whereIn($column, $ids);
    }

    /**
     * Batasi query lewat relasi detail lembaga (mis. psb_calon_lembaga):
     * admin MD melihat calon satuan MD + calon paket MI-MD (punya baris anak MD).
     */
    protected function scopeLembagaRelasi($query, User $auth, Request $request, string $relation = 'lembagaDetail')
    {
        $filter = fn ($q) => $q->where('lembaga_id', $request->integer('lembaga_id'));

        if ($auth->bolehPesantren()) {
            if ($request->filled('lembaga_id')) {
                $query->whereHas($relation, $filter);
            }

            return $query;
        }

        $ids = $auth->lembagaIdsDenganPasangan();
        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }
        if ($request->filled('lembaga_id')) {
            $this->authorizeLembaga($auth, (int) $request->input('lembaga_id'));

            return $query->whereHas($relation, $filter);
        }

        return $query->whereHas($relation, fn ($q) => $q->whereIn('lembaga_id', $ids));
    }

    /**
     * Aksi siklus per lembaga: admin scoped wajib punya riwayat aktif santri
     * di lembaga target (aksi ketat AND per-lembaga).
     */
    protected function authorizeAksiLembaga(Request $request, Santri $santri, int $target): void
    {
        $this->authorizeLembaga($request->user(), $target);
        $auth = $request->user();
        if ($auth->bolehPesantren()) {
            return;
        }
        $punya = RiwayatBelajar::where('santri_id', $santri->id)
            ->where('lembaga_id', $target)
            ->where('is_active_riwayat', RiwayatBelajar::YA)
            ->exists();
        if (! $punya) {
            abort(403, 'Akses ditolak.');
        }
    }

    /** Target aksi siklus wajib lembaga operasional (bukan root pesantren). */
    protected function tolakLembagaRoot(int $lembagaId): void
    {
        if (! Lembaga::where('id', $lembagaId)->whereNotNull('parent_id')->exists()) {
            throw ValidationException::withMessages(['lembaga_id' => 'Lembaga harus lembaga operasional (bukan induk pesantren).']);
        }
    }

    /** TA wajib berlaku untuk lembaga target (TA global dikurangi yang disembunyikan). */
    protected function cekTaEfektif(int $lembagaId, string $ta, string $field = 'tahun_ajaran'): void
    {
        if (! TahunAjaran::efektif($lembagaId)->contains('nama', $ta)) {
            throw ValidationException::withMessages([$field => 'Tahun ajaran tidak berlaku untuk lembaga ini.']);
        }
    }
}
