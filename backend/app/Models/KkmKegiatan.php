<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * KKM per kegiatanEvaluatif: satu baris per komponen (`kegiatan` = nama komponen)
 * + satu baris khusus `AKHIR` yang jadi jangkar predikat rapor.
 */
class KkmKegiatan extends Model
{
    /** Label baris khusus untuk KKM nilai akhir. */
    public const AKHIR = 'AKHIR';

    protected $table = 'kkm_kegiatan';

    protected $guarded = ['id'];

    protected $casts = ['kkm' => 'float'];

    public function kegiatanEvaluatif(): BelongsTo
    {
        return $this->belongsTo(KegiatanEvaluatif::class, 'kegiatan_evaluatif_id');
    }
}
