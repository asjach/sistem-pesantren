<?php

namespace App\Models\Papan;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sub-modul pada papan (mis. "E.3 Rekap & Tutup Buku Kas").
 *
 * Sub-modul TIDAK menyimpan statusnya sendiri: statusnya diturunkan dari
 * poin-poinnya (lihat `PapanService::statusTurunan`). Karena itu
 * tabelnya hanya berisi identitas dan rujukan, tanpa kolom status — supaya
 * tidak ada dua sumber status yang bisa saling bertentangan.
 */
class PapanItem extends Model
{
    /** Kosakata status yang sah untuk POIN di dalam sub-modul ini. */
    public const STATUS = ['pending', 'backlog', 'todo', 'in_progress', 'for_review', 'done'];

    protected $connection = 'papan';

    protected $table = 'papan_item';

    protected $fillable = ['modul_id', 'kode', 'nama', 'rujukan', 'urutan'];

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
