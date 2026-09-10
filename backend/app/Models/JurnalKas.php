<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JurnalKas extends Model
{
    protected $table = 'jurnal_kas';
    protected $guarded = ['id'];
    protected $casts = ['nominal' => 'decimal:2', 'tgl_transaksi' => 'date'];

    public function akunKas(): BelongsTo
    {
        return $this->belongsTo(AkunKas::class, 'akun_kas_id');
    }

    public function pembayaran(): BelongsTo
    {
        return $this->belongsTo(Pembayaran::class, 'pembayaran_id');
    }
}
