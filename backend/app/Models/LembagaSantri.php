<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Keanggotaan santri di satu lembaga (bukan pivot murni):
 * membawa NIS lokal/kemenag, status aktif, dan rentang tanggal keanggotaan.
 *
 * - `nis_lokal` diisi manual (unik per lembaga).
 * - `nis_kemenag` nullable, digenerate manual di Buku Induk (NSM + YY + 4 digit akhir nis_lokal).
 * - Multi-lembaga paralel diizinkan; maks 1 baris aktif per santri+lembaga (invariant service).
 */
class LembagaSantri extends Model
{
    protected $table = 'lembaga_santri';

    protected $fillable = [
        'santri_id',
        'lembaga_id',
        'nis_lokal',
        'nis_kemenag',
        'is_active',
        'tgl_mulai',
        'tgl_selesai',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'tgl_mulai' => 'date:Y-m-d',
        'tgl_selesai' => 'date:Y-m-d',
    ];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class, 'santri_id');
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'lembaga_id');
    }

    public function scopeTenantScope(Builder $query): Builder
    {
        $authUser = auth()->user();

        if ($authUser->hasRole('super_admin') || $authUser->isAdminFull()) {
            return $query;
        }

        if ($authUser->hasAnyRole(['guru', 'orang_tua', 'santri'])) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('lembaga_id', $authUser->lembagaIds());
    }

    /** NIS lokal wajib unik per lembaga. */
    public static function nisLokalDipakai(int $lembagaId, ?string $nisLokal, ?int $kecualiId = null): bool
    {
        $nis = $nisLokal !== null ? trim($nisLokal) : '';

        if ($nis === '') {
            return false;
        }

        return static::where('lembaga_id', $lembagaId)
            ->where('nis_lokal', $nis)
            ->when($kecualiId, fn (Builder $q) => $q->whereKeyNot($kecualiId))
            ->exists();
    }

    /** NIS kemenag (bila diisi) wajib unik per lembaga. */
    public static function nisKemenagDipakai(int $lembagaId, ?string $nisKemenag, ?int $kecualiId = null): bool
    {
        $nis = $nisKemenag !== null ? trim($nisKemenag) : '';

        if ($nis === '') {
            return false;
        }

        return static::where('lembaga_id', $lembagaId)
            ->where('nis_kemenag', $nis)
            ->when($kecualiId, fn (Builder $q) => $q->whereKeyNot($kecualiId))
            ->exists();
    }

    /** Baris keanggotaan aktif untuk pasangan santri+lembaga (maks 1). */
    public static function aktif(int $santriId, int $lembagaId): ?self
    {
        return static::where('santri_id', $santriId)
            ->where('lembaga_id', $lembagaId)
            ->where('is_active', true)
            ->first();
    }
}
