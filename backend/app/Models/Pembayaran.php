<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pembayaran extends Model
{
    protected $table = 'pembayaran';

    protected $guarded = ['id'];

    protected $casts = ['jumlah' => 'integer'];

    public function tagihan(): BelongsTo
    {
        return $this->belongsTo(Tagihan::class);
    }

    /** Header transaksi (kwitansi) pemilik baris ini. */
    public function transaksi(): BelongsTo
    {
        return $this->belongsTo(TransaksiPembayaran::class, 'transaksi_id');
    }
}
