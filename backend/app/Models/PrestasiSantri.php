<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Prestasi santri (satu baris per prestasi; boleh beberapa baris per santri). */
class PrestasiSantri extends Model
{
    protected $table = 'prestasi_santri';

    protected $guarded = ['id'];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }
}
