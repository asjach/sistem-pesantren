<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Cakupan tingkat untuk satu mapel di dalam kurikulum.
 *
 * **Daftar kosong = mapel berlaku di SEMUA tingkat** (menjaga perilaku lama saat
 * `kurikulum_mapel.tingkat` null). Berisi = mapel hanya berlaku di kelas-kelas
 * yang tingkatnya termasuk daftar itu. Nilai `tingkat` = NAMA tingkat dari
 * referensi (sama dengan `kelas.tingkat`), jadi lintas tahun ajaran.
 */
class KurikulumMapelTingkat extends Model
{
    protected $table = 'kurikulum_mapel_tingkat';

    protected $guarded = ['id'];

    public function kurikulumMapel(): BelongsTo
    {
        return $this->belongsTo(KurikulumMapel::class);
    }
}
