<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JenisTagihan extends Model
{
    protected $table = 'jenis_tagihan';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];

    /** Lembaga penerbit (null = iuran global semua lembaga). */
    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }
}
