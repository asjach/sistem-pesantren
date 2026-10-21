<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PengaturanNomorPeserta extends Model
{
    public const PER_TINGKAT = 'per_tingkat';

    public const SEMUA_TINGKAT = 'semua_tingkat';

    protected $table = 'pengaturan_nomor_peserta';

    protected $fillable = [
        'kegiatan_evaluatif_id',
        'semester',
        'template',
        'mode_urutan',
    ];

    /** @return BelongsTo<KegiatanEvaluatif, $this> */
    public function kegiatanEvaluatif(): BelongsTo
    {
        return $this->belongsTo(KegiatanEvaluatif::class, 'kegiatan_evaluatif_id');
    }
}
