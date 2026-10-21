<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Nilai akhir santri per (pengampu × TA × semester × KEGIATAN EVALUATIF).
 * `sumber` menandai jalur pengisian: 'hitung' (komponen × bobot),
 * 'impor' (leger langsung), atau 'manual' (input langsung per sel di Leger).
 */
class NilaiSantri extends Model
{
    public const HITUNG = 'hitung';

    public const IMPOR = 'impor';

    public const MANUAL = 'manual';

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

    public function kegiatanEvaluatif(): BelongsTo
    {
        return $this->belongsTo(KegiatanEvaluatif::class, 'kegiatan_evaluatif_id');
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }
}
