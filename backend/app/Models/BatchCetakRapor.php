<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Snapshot penanda tangan saat sebuah kelas pertama kali dicetak massal. */
class BatchCetakRapor extends Model
{
    protected $table = 'batch_cetak_rapor';

    protected $fillable = ['kegiatan_evaluatif_id', 'semester', 'kelas_id', 'wali_kelas', 'kepala'];

    /** @return BelongsTo<KegiatanEvaluatif, $this> */
    public function kegiatanEvaluatif(): BelongsTo
    {
        return $this->belongsTo(KegiatanEvaluatif::class, 'kegiatan_evaluatif_id');
    }

    /** @return BelongsTo<Kelas, $this> */
    public function kelas(): BelongsTo
    {
        return $this->belongsTo(Kelas::class, 'kelas_id');
    }
}
