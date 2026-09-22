<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// 102 Fase A: arsip keluar per-lembaga (paket: 1 jenjang keluar, lainnya jalan terus).
// Ditulis hanya via SiklusSantriService::prosesMutasiPerLembaga.
class MutasiKeluar extends Model
{
    protected $table = 'mutasi_keluar';

    protected $guarded = ['id'];

    protected $casts = ['tanggal_mutasi' => 'date'];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function kelasTerakhir(): BelongsTo
    {
        return $this->belongsTo(Kelas::class, 'kelas_terakhir_id');
    }

    // Tenant lembaga se-pesantren (pola Kelas): super_admin/admin full semua;
    // guru/orang_tua/santri kosong; lainnya via pivot user_lembaga.
    public function scopeTenantScope(Builder $query): Builder
    {
        $user = auth()->user();
        if ($user->bolehPesantren()) {
            return $query;
        }
        if ($user->hasAnyRole(['orang_tua', 'guru', 'santri'])) {
            return $query->whereRaw('1 = 0');
        }
        $ids = $user->lembagaIdsDenganPasangan();
        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('jenjang', $ids);
    }
}
