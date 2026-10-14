<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Urutan + tampil/sembunyi tab halaman gabungan — satu baris per `page_key`,
 * global untuk semua pengguna (diatur super_admin).
 *
 * `urutan` berisi daftar rute tab (mis. `/users`); rute itu sendiri
 * didefinisikan di kode (`src/lib/halaman.ts`), jadi tabel ini TIDAK bisa
 * membuat tab baru — hanya mengatur tab yang sudah terdaftar.
 */
class PengaturanHalaman extends Model
{
    protected $table = 'pengaturan_halaman';

    protected $fillable = ['page_key', 'urutan', 'sembunyi', 'diubah_oleh'];

    protected $casts = [
        'urutan' => 'array',
        'sembunyi' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function diubahOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diubah_oleh');
    }
}
