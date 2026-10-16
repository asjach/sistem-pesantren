<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Bobot satu komponen pada satu tahun ajaran (boleh berubah tiap TA). */
class KomponenNilaiBobot extends Model
{
    protected $table = 'komponen_nilai_bobot';

    protected $guarded = ['id'];

    protected $casts = ['bobot' => 'float'];

    public function komponen(): BelongsTo
    {
        return $this->belongsTo(KomponenNilai::class, 'komponen_nilai_id');
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }
}
