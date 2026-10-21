<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PesertaKegiatanEvaluatif extends Model
{
    public const MANUAL = 'manual';

    public const OTOMATIS = 'otomatis';

    protected $table = 'peserta_kegiatan_evaluatif';

    protected $fillable = [
        'kegiatan_evaluatif_id',
        'santri_id',
        'semester',
        'nomor_peserta',
        'sumber_nomor',
    ];

    /** @return BelongsTo<KegiatanEvaluatif, $this> */
    public function kegiatanEvaluatif(): BelongsTo
    {
        return $this->belongsTo(KegiatanEvaluatif::class, 'kegiatan_evaluatif_id');
    }

    /** @return BelongsTo<Santri, $this> */
    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }
}
