<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Header transaksi pembayaran: satu baris = satu kwitansi yang dapat memuat
 * beberapa baris `pembayaran` (satu santri, banyak tagihan).
 */
class TransaksiPembayaran extends Model
{
    protected $table = 'transaksi_pembayaran';

    protected $guarded = ['id'];

    protected $casts = ['total' => 'integer'];

    /** Baris detail per tagihan. */
    public function pembayaran(): HasMany
    {
        return $this->hasMany(Pembayaran::class, 'transaksi_id');
    }

    /** Kasir yang menerima. */
    public function penerima(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diterima_oleh');
    }
}
