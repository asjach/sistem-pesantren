<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Preset urut global per `table_key`: daftar opsi urut yang tampil di dropdown
 * Urutkan (kode urut backend + label + arah + penanda bawaan).
 */
class UrutPreset extends Model
{
    protected $table = 'urut_preset';

    protected $fillable = ['table_key', 'opsi', 'dibuat_oleh'];

    protected $casts = [
        'opsi' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function dibuatOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
