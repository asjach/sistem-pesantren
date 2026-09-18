<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Visibilitas kontrol toolbar generik, GLOBAL per `table_key`: peta
 * kontrol → boolean (`cari`, `info`, `urut`, `kolom`). Hanya nilai `false`
 * yang menyembunyikan; kunci absen/true/null = tampil.
 */
class ToolbarPreset extends Model
{
    protected $table = 'toolbar_preset';

    protected $fillable = ['table_key', 'visibilitas', 'dibuat_oleh'];

    protected $casts = [
        'visibilitas' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function dibuatOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
