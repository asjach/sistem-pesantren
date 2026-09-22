<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Pivot visibilitas TA per lembaga (pengganti "baris bayangan"). */
class LembagaTahunAjaran extends Model
{
    protected $table = 'lembaga_tahun_ajaran';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }
}
