<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Template jadwal = kerangka jam murni per jenjang (tanpa mapel/pengampu):
 * daftar jam generik (mis. "8 JP + istirahat") yang berlaku untuk semua hari
 * aktif. Diterapkan = membuat `slot_jam_pelajaran` nyata di jenjang itu.
 */
class TemplateJadwal extends Model
{
    protected $table = 'template_jadwal';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function baris(): HasMany
    {
        return $this->hasMany(TemplateJadwalBaris::class);
    }
}
