<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TarifTagihan extends Model
{
    protected $table = 'tarif_tagihan';

    protected $guarded = ['id'];

    protected $casts = ['nominal' => 'integer', 'is_active' => 'boolean'];

    public function jenis(): BelongsTo
    {
        return $this->belongsTo(JenisTagihan::class, 'jenis_id');
    }
}
