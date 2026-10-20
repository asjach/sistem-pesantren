<?php

namespace App\Models\Papan;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Modul pada papan perkembangan proyek (mis. "Keuangan").
 *
 * Berada di koneksi `papan` (SQLite terpisah) agar tidak terhapus saat
 * `migrate:fresh` DB pesantren.
 */
class PapanModul extends Model
{
    protected $connection = 'papan';

    protected $table = 'papan_modul';

    protected $fillable = ['aplikasi', 'kode', 'nama', 'urutan', 'catatan'];

    /** @return HasMany<PapanItem, $this> */
    public function item(): HasMany
    {
        return $this->hasMany(PapanItem::class, 'modul_id')->orderBy('urutan');
    }
}
