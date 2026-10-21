<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Halaman yang ikut pencarian global non-Board. */
class PengaturanPencarian extends Model
{
    protected $table = 'pengaturan_pencarian';

    protected $fillable = ['page_key', 'aktif', 'diubah_oleh'];

    protected $casts = ['aktif' => 'boolean'];
}
