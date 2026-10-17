<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu mapel di dalam satu kurikulum: `kkm` null = tak dipakai, `urutan`
 * mengendalikan urutan tampil di rapor/leger, dan cakupan tingkatnya (opsional)
 * disimpan di tabel anak `kurikulum_mapel_tingkat` — kosong = berlaku semua tingkat.
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

    /** Tingkat yang dicakup mapel ini; KOSONG = berlaku di semua tingkat. */
    public function tingkat(): HasMany
    {
        return $this->hasMany(KurikulumMapelTingkat::class);
    }

    /** Daftar nama tingkat yang dicakup (dipakai respons & validasi simpan). */
    public function tingkatList(): array
    {
        return $this->tingkat()->pluck('tingkat')->map(fn ($t) => (string) $t)->all();
    }
}
