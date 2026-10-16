<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * KKM per peristiwa penilaian: satu baris per komponen + satu baris khusus
 * `AKHIR` (komponen_nilai_id null) per (jenjang, TA).
 */
class KkmKegiatan extends Model
{
    /** Label baris khusus untuk KKM nilai akhir. */
    public const AKHIR = 'AKHIR';

    protected $table = 'kkm_kegiatan';

    protected $guarded = ['id'];

    protected $casts = ['kkm' => 'float'];

    public function komponen(): BelongsTo
    {
        return $this->belongsTo(KomponenNilai::class, 'komponen_nilai_id');
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }
}
