<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu mapel di dalam satu kurikulum: `tingkat` null = berlaku semua tingkat,
 * `kkm` null = tak dipakai, `urutan` mengendalikan urutan tampil di rapor/leger.
 */
class KurikulumMapel extends Model
{
    protected $table = 'kurikulum_mapel';

    protected $guarded = ['id'];

    protected $casts = ['kkm' => 'float', 'urutan' => 'integer'];

    public function kurikulum(): BelongsTo
    {
        return $this->belongsTo(Kurikulum::class);
    }

    public function mataPelajaran(): BelongsTo
    {
        return $this->belongsTo(MataPelajaran::class);
    }
}
