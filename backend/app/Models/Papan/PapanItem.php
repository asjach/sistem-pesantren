<?php

namespace App\Models\Papan;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sub-modul pada papan (mis. "E.3 Rekap & Tutup Buku Kas").
 *
 * Satu item boleh punya banyak butir; status item adalah ringkasan
 * kelompok kerjanya. Perpindahan status dicatat di {@see PapanRiwayat}.
 */
class PapanItem extends Model
{
    public const STATUS = ['sudah', 'sedang', 'akan', 'ditunda'];

    protected $connection = 'papan';

    protected $table = 'papan_item';

    protected $fillable = ['modul_id', 'kode', 'nama', 'status', 'rujukan', 'urutan'];

    /** @return BelongsTo<PapanModul, $this> */
    public function modul(): BelongsTo
    {
        return $this->belongsTo(PapanModul::class, 'modul_id');
    }

    /** @return HasMany<PapanButir, $this> */
    public function butir(): HasMany
    {
        return $this->hasMany(PapanButir::class, 'item_id')->orderBy('urutan');
    }

    /** @return HasMany<PapanRiwayat, $this> */
    public function riwayat(): HasMany
    {
        return $this->hasMany(PapanRiwayat::class, 'item_id')->latest('waktu');
    }
}
