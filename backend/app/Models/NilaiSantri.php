<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Nilai akhir santri per pengampu (kelas × mapel) per TA × semester.
 * Kolom `nilai_formatif`/`nilai_sumatif` dibiarkan 0 (tak dipakai modul
 * penilaian); `nilai_akhir` diisi jalur HITUNG (`sumber='hitung'`) atau
 * IMPOR leger (`sumber='impor'`).
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

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }
}
