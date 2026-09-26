<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Penempatan pegawai di satu lembaga (pivot kaya, cermin `lembaga_santri`):
 * NIPP unik per lembaga, tugas utama, status aktif, rentang tanggal.
 *
 * Invarian: maks 1 baris per (pegawai, lembaga). Masuk-lagi-setelah-keluar
 * = aktifkan ulang baris yang sama (bukan baris baru).
 */
class LembagaPegawai extends Model
{
    public const YA = 'Ya';

    public const TIDAK = 'Tidak';

    protected $table = 'lembaga_pegawai';

    protected $attributes = ['is_active_lembaga' => self::YA, 'tugas_utama' => 'Guru Pengampu'];

    protected $fillable = [
        'pegawai_id',
        'jenjang',
        'nipp',
        'tugas_utama',
        'is_active_lembaga',
        'tgl_masuk',
        'tgl_selesai',
        'tahaj_masuk',
    ];

    protected $casts = [
        'tgl_masuk' => 'date:Y-m-d',
        'tgl_selesai' => 'date:Y-m-d',
    ];

    public function pegawai(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class, 'pegawai_id');
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

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

        return $query->whereIn('jenjang', $authUser->lembagaIdsDenganPasangan());
    }

    /** NIPP dipakai baris LAIN di lembaga yang sama. */
    public static function nippDipakai(string $jenjang, ?string $nipp, ?int $kecualiId = null): bool
    {
        $nilai = $nipp !== null ? trim($nipp) : '';
        if ($nilai === '') {
            return false;
        }

        return static::where('jenjang', $jenjang)
            ->where('nipp', $nilai)
            ->when($kecualiId, fn (Builder $q) => $q->whereKeyNot($kecualiId))
            ->exists();
    }

    /** Baris penempatan untuk pasangan pegawai+lembaga (maks 1). */
    public static function untuk(int $pegawaiId, string $jenjang): ?self
    {
        return static::where('pegawai_id', $pegawaiId)->where('jenjang', $jenjang)->first();
    }
}
