<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Visibilitas filter topBar, GLOBAL per `table_key`: peta filter →
 * boolean (`lembaga`, `tahun_ajaran`, `semester`, `tingkat`, `kelas`).
 * Hanya nilai `false` yang menyembunyikan; kunci absen/true/null =
 * ikut bawaan kode halaman. Halaman tanpa tabel memakai page_key
 * sebagai nilai `table_key`.
 */
class PengaturanTabel extends Model
{
    protected $table = 'pengaturan_tabel';

    protected $fillable = ['table_key', 'filter', 'filter_mode', 'dibuat_oleh'];

    protected $casts = [
        'filter' => 'array',
        'filter_mode' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function dibuatOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
