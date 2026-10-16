<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Predikat berjangkar ke KKM `AKHIR`: berlaku bila nilai ≥ KKM + offset_bawah.
 * `offset_bawah` null = tanpa batas bawah (predikat terakhir, mis. D).
 */
class RentangPredikat extends Model
{
    protected $table = 'rentang_predikat';

    protected $guarded = ['id'];

    protected $casts = ['offset_bawah' => 'float'];

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }
}
