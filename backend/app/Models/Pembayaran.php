<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Minimal untuk jahitan ACC 100 (transaksi penuh di 103).
class Pembayaran extends Model
{
    protected $table = 'pembayaran';
    protected $guarded = ['id'];
    protected $casts = ['tgl_pembayaran' => 'datetime', 'total_bayar' => 'decimal:2'];

    public function tagihan(): BelongsTo { return $this->belongsTo(Tagihan::class); }
}
