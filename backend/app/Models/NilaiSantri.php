<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Nilai akhir santri per (pengampu × TA × semester × PERISTIWA).
 * `sumber` menandai jalur pengisian: 'hitung' (komponen × bobot) atau
 * 'impor' (leger langsung, menimpa hitungan).
 */
class NilaiSantri extends Model
{
    public const HITUNG = 'hitung';

    public const IMPOR = 'impor';

    protected $table = 'nilai_santri';

    protected $guarded = ['id'];

    protected $casts = [
        'nilai_formatif' => 'float',
        'nilai_sumatif' => 'float',
        'nilai_akhir' => 'float',
    ];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }

    public function pengampuMapel(): BelongsTo
    {
        return $this->belongsTo(PengampuMapel::class);
    }

    public function peristiwa(): BelongsTo
    {
        return $this->belongsTo(PeristiwaNilai::class, 'peristiwa_id');
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }
}
