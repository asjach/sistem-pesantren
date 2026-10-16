<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Nilai ekstrakurikuler santri. Pembimbing diambil dari master
 * `ekstrakurikuler` (bukan dari berkas impor).
 */
class NilaiEkstrakurikuler extends Model
{
    protected $table = 'nilai_ekstrakurikuler';

    protected $guarded = ['id'];

    protected $casts = ['nilai' => 'float'];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }

    public function ekstrakurikuler(): BelongsTo
    {
        return $this->belongsTo(Ekstrakurikuler::class);
    }
}
