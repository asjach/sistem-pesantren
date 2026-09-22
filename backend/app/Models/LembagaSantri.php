<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Keanggotaan santri di satu lembaga (bukan pivot murni):
 * membawa NIS lokal/kemenag, status aktif, rentang tanggal, dan asal masuk.
 *
 * - `nis_lokal` diisi manual (unik per lembaga).
 * - `nis_kemenag` nullable, digenerate manual di Buku Induk (NSM + YY + 4 digit akhir nis_lokal).
 * - `is_active_lembaga` = 'Ya'/'Tidak' (string ENUM), sedang menjadi santri lembaga ini.
 * - `tgl_masuk` diisi saat diterima (PSB/dialog/import), `tgl_selesai` saat kelulusan/mutasi.
 * - `tahaj_masuk`/`tingkat_masuk`/`no_urut` menyimpan konteks penerimaan;
 *   `*_sekolah_asal` menyimpan detail sekolah asal.
 * - Multi-lembaga paralel diizinkan; maks 1 baris aktif per santri+lembaga (invariant service).
 */
class LembagaSantri extends Model
{
    /** Nilai kanonis kolom keaktifan (ENUM). */
    public const YA = 'Ya';

    public const TIDAK = 'Tidak';

    protected $table = 'lembaga_santri';

    /** Bawaan keanggotaan aktif (juga menutup default DB saat rename di SQLite). */
    protected $attributes = ['is_active_lembaga' => self::YA];

    protected $fillable = [
        'santri_id',
        'jenjang',
        'nis_lokal',
        'nis_kemenag',
        'tahaj_masuk',
        'tingkat_masuk',
        'no_urut',
        'nama_sekolah_asal',
        'npsn_sekolah_asal',
        'nss_sekolah_asal',
        'alamat_sekolah_asal',
        'is_active_lembaga',
        'tgl_masuk',
        'tgl_selesai',
    ];

    protected $casts = [
        'tgl_masuk' => 'date:Y-m-d',
        'tgl_selesai' => 'date:Y-m-d',
    ];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class, 'santri_id');
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    /** Keaktifan sebagai boolean (bandingkan string ENUM secara eksplisit). */
    public function isActive(): bool
    {
        return $this->is_active_lembaga === self::YA;
    }

    public function scopeTenantScope(Builder $query): Builder
    {
        $authUser = auth()->user();

        if ($authUser->bolehPesantren()) {
            return $query;
        }

        if ($authUser->hasAnyRole(['guru', 'orang_tua', 'santri'])) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('jenjang', $authUser->lembagaIdsDenganPasangan());
    }

    /** NIS lokal wajib unik per lembaga. */
    public static function nisLokalDipakai(string $jenjang, ?string $nisLokal, ?int $kecualiId = null): bool
    {
        $nis = $nisLokal !== null ? trim($nisLokal) : '';

        if ($nis === '') {
            return false;
        }

        return static::where('jenjang', $jenjang)
            ->where('nis_lokal', $nis)
            ->when($kecualiId, fn (Builder $q) => $q->whereKeyNot($kecualiId))
            ->exists();
    }

    /** NIS kemenag (bila diisi) wajib unik per lembaga. */
    public static function nisKemenagDipakai(string $jenjang, ?string $nisKemenag, ?int $kecualiId = null): bool
    {
        $nis = $nisKemenag !== null ? trim($nisKemenag) : '';

        if ($nis === '') {
            return false;
        }

        return static::where('jenjang', $jenjang)
            ->where('nis_kemenag', $nis)
            ->when($kecualiId, fn (Builder $q) => $q->whereKeyNot($kecualiId))
            ->exists();
    }

    /** Baris keanggotaan aktif untuk pasangan santri+lembaga (maks 1). */
    public static function aktif(int $santriId, string $jenjang): ?self
    {
        return static::where('santri_id', $santriId)
            ->where('jenjang', $jenjang)
            ->where('is_active_lembaga', self::YA)
            ->first();
    }
}
