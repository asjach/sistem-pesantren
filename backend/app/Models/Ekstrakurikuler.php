<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Master ekstrakurikuler per (jenjang, TA). */
class Ekstrakurikuler extends Model
{
    protected $table = 'ekstrakurikuler';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function nilai(): HasMany
    {
        return $this->hasMany(NilaiEkstrakurikuler::class);
    }
}
