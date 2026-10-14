<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Standar tampilan global (key-value) yang berlaku untuk semua pengguna.
 *
 * Merupakan LAPISAN BAWAH: pengguna masih boleh menimpanya sendiri di
 * perangkatnya, jadi baris di sini tidak mengunci apa pun.
 */
class PengaturanGlobal extends Model
{
    protected $table = 'pengaturan_global';

    protected $fillable = ['kunci', 'nilai', 'diubah_oleh'];

    protected $casts = [
        'nilai' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function diubahOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diubah_oleh');
    }
}
