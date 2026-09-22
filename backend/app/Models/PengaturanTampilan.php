<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Standar tampilan per lembaga; `data` JSON berisi tema, parts, grid, preset aktif, lebar/beku.
class PengaturanTampilan extends Model
{
    protected $table = 'pengaturan_tampilan';

    protected $guarded = ['id'];

    protected $casts = [
        'data' => 'array',
        'versi' => 'integer',
    ];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function pengubah(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diubah_oleh');
    }
}
