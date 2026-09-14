<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class TahunAjaran extends Model
{
    protected $table = 'tahun_ajaran';

    protected $fillable = ['lembaga_id', 'nama', 'tanggal_mulai', 'tanggal_selesai', 'is_aktif'];

    public function lembaga()
    {
        return $this->belongsTo(Lembaga::class);
    }

    /**
     * Resolusi TA untuk satu lembaga operasional: TA yang diminta bila milik
     * lembaga itu, bila tidak TA aktif milik lembaga itu. Root tidak pernah valid.
     */
    public static function resolveUntukLembaga(int $lembagaId, ?int $dimintaId = null): int
    {
        if ($dimintaId) {
            $diminta = static::find($dimintaId);
            if ($diminta && (int) $diminta->lembaga_id === $lembagaId) {
                return $diminta->id;
            }
        }
        $aktif = static::where('lembaga_id', $lembagaId)->where('is_aktif', true)
            ->orderBy('tanggal_mulai')->orderBy('id')->first();
        if ($aktif) {
            return $aktif->id;
        }
        throw ValidationException::withMessages(['tahun_ajaran_id' => 'Lembaga belum memiliki tahun ajaran aktif.']);
    }

    public function scopeTenantScope(Builder $query): Builder
    {
        $user = auth()->user();
        if ($user->hasRole('super_admin')) {
            return $query;
        }
        if ($user->hasAnyRole(['orang_tua', 'guru', 'santri'])) {
            return $query->whereRaw('1 = 0');
        }
        if ($user->hasRole('admin') && $user->isAdminFull()) {
            return $query;
        }
        $ids = $user->lembagaIds();
        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('lembaga_id', $ids);
    }
}
