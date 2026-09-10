<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Kelas extends Model
{
    protected $table = 'kelas';
    protected $fillable = ['lembaga_id', 'tahun_ajaran_id', 'walas_id', 'tingkat', 'nama_kelas', 'kapasitas'];

    public function lembaga() { return $this->belongsTo(Lembaga::class); }
    public function tahunAjaran() { return $this->belongsTo(TahunAjaran::class); }
    public function walas() { return $this->belongsTo(Pegawai::class, 'walas_id'); }

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
