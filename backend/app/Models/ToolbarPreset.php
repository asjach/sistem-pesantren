<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Visibilitas kontrol toolbar generik, GLOBAL per `table_key`: peta
 * kontrol → boolean (`cari`, `info`, `urut`, `kolom`). Hanya nilai `false`
 * yang menyembunyikan; kunci absen/true/null = tampil.
 * Perataan kolom per tabel (satu nilai per kolom, bukan per preset):
 * peta key kolom → 'left'|'center'|'right'; absen = bawaan frontend.
 */
class ToolbarPreset extends Model
{
    protected $table = 'toolbar_preset';

    protected $fillable = ['table_key', 'visibilitas', 'lebar', 'urutan', 'align', 'dibuat_oleh'];

    protected $casts = [
        'visibilitas' => 'array',
        'lebar' => 'array',
        'urutan' => 'array',
        'align' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function dibuatOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
