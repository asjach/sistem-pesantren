<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu aturan potongan dalam paket dispensasi (`jenis_id` null = semua jenis). */
class DispensasiAturan extends Model
{
    protected $table = 'dispensasi_aturan';

    protected $fillable = [
        'dispensasi_id', 'jenis_id', 'tipe', 'nilai',
    ];

    protected $casts = [
        'nilai' => 'integer',
    ];

    public function dispensasi(): BelongsTo
    {
        return $this->belongsTo(Dispensasi::class, 'dispensasi_id');
    }

    public function jenis(): BelongsTo
    {
        return $this->belongsTo(JenisTagihan::class, 'jenis_id');
    }
}
