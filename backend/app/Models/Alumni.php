<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// 102 Fase A: max 1 baris per santri (unique santri_id, last-wins antar lembaga paket).
// Ditulis hanya via SiklusSantriService::prosesLulusPerLembaga (updateOrCreate + retry 1062).
class Alumni extends Model
{
    protected $table = 'alumni';

    protected $guarded = ['id'];

    protected $casts = ['tanggal_lulus' => 'date'];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }

    public function lembagaLulus(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'lembaga_lulus', 'jenjang');
    }

    public function tahunAjaranLulus(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran_lulus', 'nama');
    }

    /** Kelas terakhir saat lulus — snapshot beku, tidak mengikuti perubahan kelas. */
    public function kelasLulus(): BelongsTo
    {
        return $this->belongsTo(Kelas::class, 'kelas_lulus_id');
    }

    // Tenant lembaga via lembaga_lulus (pola Kelas): super_admin/admin full semua;
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

        return $query->whereIn('lembaga_lulus', $ids);
    }
}
