<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu sel struktur kurikulum: JP per minggu sebuah mapel pada satu tingkat,
 * dalam lingkup jenjang + tahun ajaran. Hanya referensi, bukan pengunci jadwal.
 */
class StrukturKurikulum extends Model
{
    protected $table = 'struktur_kurikulum';

    protected $guarded = ['id'];

    protected $casts = ['jp_per_minggu' => 'integer'];

    public function mataPelajaran(): BelongsTo
    {
        return $this->belongsTo(MataPelajaran::class);
    }

    /** Varian jadwal pemilik sel ini (struktur mengikuti varian). */
    public function varian(): BelongsTo
    {
        return $this->belongsTo(VarianJadwal::class, 'varian_jadwal_id');
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }
}
