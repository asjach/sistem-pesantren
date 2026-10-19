<?php

namespace App\Models\Papan;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Catatan perpindahan status sebuah sub-modul — inilah jejak yang dipakai
 * untuk melacak perkembangan proyek dari waktu ke waktu.
 */
class PapanRiwayat extends Model
{
    protected $connection = 'papan';

    protected $table = 'papan_riwayat';

    public $timestamps = false;

    protected $fillable = ['item_id', 'dari_status', 'ke_status', 'catatan', 'diubah_oleh', 'waktu'];

    protected $casts = ['waktu' => 'datetime'];

    /** @return BelongsTo<PapanItem, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(PapanItem::class, 'item_id');
    }
}
