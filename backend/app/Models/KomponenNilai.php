<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Komponen penilaian MILIK SATU PERISTIWA (daftar komponen terpisah tiap
 * peristiwa — keputusan pengguna 2026-10-16). Bobot jadi kolom karena
 * peristiwa sudah terikat tahun ajaran.
 *
 *  Tiga sumber nilai:
 *  - `manual`         : diisi guru lewat impor/edit;
 *  - `rapor_otomatis` : rata-rata rapor `jumlah_tingkat_rapor` tingkat sebelumnya;
 *  - `peristiwa`      : nilai akhir peristiwa LAIN (`peristiwa_sumber_id`) untuk
 *                       mapel yang sama — mis. komponen "PTS" di ASAS/ASAT
 *                       mengambil nilai akhir peristiwa PTS.
 *
 *  Dua sumber otomatis tetap boleh ditimpa baris `nilai_komponen` manual.
 */
class KomponenNilai extends Model
{
    public const MANUAL = 'manual';

    public const RAPOR_OTOMATIS = 'rapor_otomatis';

    public const PERISTIWA = 'peristiwa';

    protected $table = 'komponen_nilai';

    protected $guarded = ['id'];

    protected $casts = [
        'is_active' => 'boolean',
        'urutan' => 'integer',
        'bobot' => 'float',
        'jumlah_tingkat_rapor' => 'integer',
        'peristiwa_sumber_id' => 'integer',
    ];

    public function peristiwa(): BelongsTo
    {
        return $this->belongsTo(PeristiwaNilai::class, 'peristiwa_id');
    }

    /** Peristiwa asal bila `sumber='peristiwa'`. */
    public function peristiwaSumber(): BelongsTo
    {
        return $this->belongsTo(PeristiwaNilai::class, 'peristiwa_sumber_id');
    }

    public function otomatisDariRapor(): bool
    {
        return $this->sumber === self::RAPOR_OTOMATIS;
    }

    public function otomatisDariPeristiwa(): bool
    {
        return $this->sumber === self::PERISTIWA && $this->peristiwa_sumber_id !== null;
    }
}
