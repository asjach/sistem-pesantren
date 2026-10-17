<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu jam generik dalam kerangka template: jam ke-n + nama + jam
 * mulai–selesai + penanda istirahat. Berlaku untuk semua hari aktif lembaga
 * (tanpa mapel/pengampu).
 */
class TemplateJadwalBaris extends Model
{
    protected $table = 'template_jadwal_baris';

    protected $guarded = ['id'];

    protected $casts = ['urutan_slot' => 'integer'];

    public function template(): BelongsTo
    {
        return $this->belongsTo(TemplateJadwal::class, 'template_jadwal_id');
    }
}
