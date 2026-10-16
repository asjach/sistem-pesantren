<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Skor satu komponen untuk satu santri pada satu pengampu (jalur HITUNG). */
class NilaiKomponen extends Model
{
    protected $table = 'nilai_komponen';

    protected $guarded = ['id'];

    protected $casts = ['skor' => 'float'];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }

    public function pengampuMapel(): BelongsTo
    {
        return $this->belongsTo(PengampuMapel::class);
    }

    public function komponen(): BelongsTo
    {
        return $this->belongsTo(KomponenNilai::class, 'komponen_nilai_id');
    }
}
