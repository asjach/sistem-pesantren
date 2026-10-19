<?php

namespace App\Models\Papan;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Catatan perpindahan status sebuah POIN (butir) — inilah jejak yang dipakai
 * untuk melacak perkembangan proyek dari waktu ke waktu.
 *
 * `butir_id` boleh null untuk baris lama yang tercatat saat status masih
 * dimiliki sub-modul (sebelum model dipindah ke poin).
 */
class PapanRiwayat extends Model
{
    protected $connection = 'papan';

    protected $table = 'papan_riwayat';

    public $timestamps = false;

    protected $fillable = ['item_id', 'butir_id', 'dari_status', 'ke_status', 'catatan', 'diubah_oleh', 'waktu'];

    protected $casts = ['waktu' => 'datetime'];

    /** @return BelongsTo<PapanItem, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(PapanItem::class, 'item_id');
    }

    /** @return BelongsTo<PapanButir, $this> */
    public function butir(): BelongsTo
    {
        return $this->belongsTo(PapanButir::class, 'butir_id');
    }
}
