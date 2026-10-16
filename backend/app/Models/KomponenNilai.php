<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Komponen penilaian MILIK SATU PERISTIWA (daftar komponen terpisah tiap
 * peristiwa — keputusan pengguna 2026-10-16). Bobot jadi kolom karena
 * peristiwa sudah terikat tahun ajaran.
 *
 *  `sumber='rapor_otomatis'` = skor dihitung otomatis dari rata-rata rapor
 *  `jumlah_tingkat_rapor` tingkat sebelumnya (mis. komponen "Rata-rata Rapor"
 *  pada peristiwa UJIAN); nilai otomatis itu boleh ditimpa manual lewat impor.
 */
class KomponenNilai extends Model
{
    public const MANUAL = 'manual';

    public const RAPOR_OTOMATIS = 'rapor_otomatis';

    protected $table = 'komponen_nilai';

    protected $guarded = ['id'];

    protected $casts = [
        'is_active' => 'boolean',
        'urutan' => 'integer',
        'bobot' => 'float',
        'jumlah_tingkat_rapor' => 'integer',
    ];

    public function peristiwa(): BelongsTo
    {
        return $this->belongsTo(PeristiwaNilai::class, 'peristiwa_id');
    }

    public function otomatisDariRapor(): bool
    {
        return $this->sumber === self::RAPOR_OTOMATIS;
    }
}
