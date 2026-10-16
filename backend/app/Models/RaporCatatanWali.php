<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Catatan wali kelas per santri × kelas × TA × semester: ketidakhadiran
 * (sakit/izin/alpa), catatan, dan keputusan kenaikan. Sumber halaman 2 rapor.
 */
class RaporCatatanWali extends Model
{
    protected $table = 'rapor_catatan_wali';

    protected $guarded = ['id'];

    protected $casts = ['sakit' => 'integer', 'izin' => 'integer', 'alpa' => 'integer'];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }

    public function kelas(): BelongsTo
    {
        return $this->belongsTo(Kelas::class);
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }
}
