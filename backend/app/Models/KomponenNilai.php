<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Komponen penilaian MILIK SATU KEGIATAN EVALUATIF (daftar komponen terpisah tiap
 * kegiatanEvaluatif — keputusan pengguna 2026-10-16). Bobot jadi kolom karena
 * kegiatanEvaluatif sudah terikat tahun ajaran.
 *
 *  Tiga sumber nilai:
 *  - `manual`         : diisi guru lewat impor/edit;
 *  - `rapor_otomatis` : rata-rata rapor `jumlah_tingkat_rapor` tingkat sebelumnya;
 *  - `kegiatanEvaluatif`      : nilai akhir kegiatanEvaluatif LAIN (`kegiatan_evaluatif_sumber_id`) untuk
 *                       mapel yang sama — mis. komponen "PTS" di ASAS/ASAT
 *                       mengambil nilai akhir kegiatanEvaluatif PTS.
 *
 *  Dua sumber otomatis tetap boleh ditimpa baris `nilai_komponen` manual.
 */
class KomponenNilai extends Model
{
    public const MANUAL = 'manual';

    public const RAPOR_OTOMATIS = 'rapor_otomatis';

    public const KEGIATAN_EVALUATIF = 'kegiatan_evaluatif';

    protected $table = 'komponen_nilai';

    protected $guarded = ['id'];

    protected $casts = [
        'is_active' => 'boolean',
        'urutan' => 'integer',
        'bobot' => 'float',
        'jumlah_tingkat_rapor' => 'integer',
        'kegiatan_evaluatif_sumber_id' => 'integer',
    ];

    public function kegiatanEvaluatif(): BelongsTo
    {
        return $this->belongsTo(KegiatanEvaluatif::class, 'kegiatan_evaluatif_id');
    }

    /** Kegiatan evaluatif asal bila `sumber='kegiatan_evaluatif'`. */
    public function kegiatanEvaluatifSumber(): BelongsTo
    {
        return $this->belongsTo(KegiatanEvaluatif::class, 'kegiatan_evaluatif_sumber_id');
    }

    public function otomatisDariRapor(): bool
    {
        return $this->sumber === self::RAPOR_OTOMATIS;
    }

    public function otomatisDariKegiatanEvaluatif(): bool
    {
        return $this->sumber === self::KEGIATAN_EVALUATIF && $this->kegiatan_evaluatif_sumber_id !== null;
    }
}
