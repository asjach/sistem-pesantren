<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Master komponen penilaian per jenjang (UH, Tugas, PTS, ASAS/UAP/UJIAN/UM).
 * Sekolah bebas menambah/menonaktifkan komponen; bobot per TA ada di
 * `komponen_nilai_bobot`.
 */
class KomponenNilai extends Model
{
    protected $table = 'komponen_nilai';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean', 'urutan' => 'integer'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function bobot(): HasMany
    {
        return $this->hasMany(KomponenNilaiBobot::class);
    }

    public function kkm(): HasMany
    {
        return $this->hasMany(KkmKegiatan::class);
    }
}
