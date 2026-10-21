<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Master kegiatan evaluatif penilaian per (jenjang, tahun ajaran).
 *
 *  Kode kanonis: ASAS (semua tingkat), ASAT (semua kecuali tingkat akhir),
 *  UJIAN (tingkat akhir jenjang Kemenag — MD tak punya), UAP (tingkat akhir,
 *  termasuk MD). Kegiatan Evaluatif TIDAK dikaitkan semester; semester tetap dimensi
 *  instans pencatatan skor di `nilai_santri`.
 */
class KegiatanEvaluatif extends Model
{
    public const ASAS = 'ASAS';

    public const ASAT = 'ASAT';

    public const UJIAN = 'UJIAN';

    public const UAP = 'UAP';

    /** Peserta: seluruh tingkat. */
    public const CAKUPAN_SEMUA = 'semua';

    /** Peserta: seluruh tingkat kecuali tingkat akhir. */
    public const CAKUPAN_KECUALI_AKHIR = 'kecuali_akhir';

    /** Peserta: hanya tingkat akhir. */
    public const CAKUPAN_TINGKAT_AKHIR = 'tingkat_akhir';

    /** Menghasilkan rapor akhir semester/tahun (mis. ASAS, ASAT). */
    public const RAPOR_AKHIR = 'akhir';

    /** Rapor sementara di tengah periode (mis. PTS bila dijadikan kegiatan evaluatif). */
    public const RAPOR_SEMENTARA = 'sementara';

    /** Tidak menghasilkan rapor — hanya nilai ujian/ijazah (mis. UJIAN, UAP). */
    public const RAPOR_TIDAK_ADA = 'tidak_ada';

    /** Pilihan rentang nilai yang sah untuk input manual/impor. */
    public const RENTANG_VALID = ['0-10', '0-100', '0-4'];

    public const RENTANG_BAWAAN = '0-100';

    protected $table = 'kegiatan_evaluatif';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean', 'urutan' => 'integer'];

    /** Batas atas nilai sesuai rentang kegiatanEvaluatif (0-10, 0-100, atau 0-4). */
    public function nilaiMaks(): float
    {
        return match ($this->rentang_nilai ?? self::RENTANG_BAWAAN) {
            '0-10' => 10.0,
            '0-4' => 4.0,
            default => 100.0,
        };
    }

    /** Apakah kegiatan evaluatif ini boleh dicetak sebagai rapor. */
    public function menghasilkanRapor(): bool
    {
        return $this->jenis_rapor !== self::RAPOR_TIDAK_ADA;
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }

    public function komponen(): HasMany
    {
        return $this->hasMany(KomponenNilai::class, 'kegiatan_evaluatif_id')->orderBy('urutan')->orderBy('nama');
    }

    public function kkm(): HasMany
    {
        return $this->hasMany(KkmKegiatan::class, 'kegiatan_evaluatif_id');
    }

    public function predikat(): HasMany
    {
        return $this->hasMany(RentangPredikat::class, 'kegiatan_evaluatif_id');
    }
}
