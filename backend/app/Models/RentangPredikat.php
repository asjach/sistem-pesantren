<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Predikat berjangkar ke KKM `AKHIR` per peristiwa: berlaku bila nilai ≥ KKM +
 * `offset_bawah`. `offset_bawah` null = tanpa batas bawah (mis. D).
 */
class RentangPredikat extends Model
{
    protected $table = 'rentang_predikat';

    protected $guarded = ['id'];

    protected $casts = ['offset_bawah' => 'float'];

    public function peristiwa(): BelongsTo
    {
        return $this->belongsTo(PeristiwaNilai::class, 'peristiwa_id');
    }
}
