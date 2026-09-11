<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class TahunAjaran extends Model
{
    protected $table = 'tahun_ajaran';
    protected $fillable = ['lembaga_id', 'nama', 'tanggal_mulai', 'tanggal_selesai', 'is_aktif'];

    public function lembaga() { return $this->belongsTo(Lembaga::class); }

    public function scopeTenantScope(Builder $query): Builder
    {
        $user = auth()->user();
        if ($user->hasRole('super_admin')) return $query;
        if ($user->hasAnyRole(['orang_tua', 'guru', 'santri'])) return $query->whereRaw('1 = 0');
        if ($user->hasRole('admin') && $user->isAdminFull()) return $query;
        $ids = $user->lembagaIds();
        if (empty($ids)) return $query->whereRaw('1 = 0');
        return $query->whereIn('lembaga_id', $ids);
    }
}
