<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AkunKas extends Model
{
    protected $table = 'akun_kas';
    protected $guarded = ['id'];
    protected $casts = ['saldo' => 'decimal:2'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class);
    }

    public function pembayaran(): HasMany
    {
        return $this->hasMany(Pembayaran::class, 'akun_kas_id');
    }

    public function jurnal(): HasMany
    {
        return $this->hasMany(JurnalKas::class, 'akun_kas_id');
    }
}
