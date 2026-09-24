<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Visibilitas filter topBar, GLOBAL per `page_key`: peta filter →
 * boolean (`lembaga`, `tahun_ajaran`, `semester`, `tingkat`, `kelas`).
 * Hanya nilai `false` yang menyembunyikan; kunci absen/true/null =
 * ikut bawaan kode halaman.
 */
class PengaturanHalaman extends Model
{
    protected $table = 'pengaturan_halaman';

    protected $fillable = ['page_key', 'filter', 'dibuat_oleh'];

    protected $casts = [
        'filter' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function dibuatOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
