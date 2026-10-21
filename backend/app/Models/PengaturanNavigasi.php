<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Visibilitas navigasi global (satu baris; diatur super_admin). */
class PengaturanNavigasi extends Model
{
    protected $table = 'pengaturan_navigasi';

    protected $fillable = ['tersembunyi', 'diubah_oleh'];

    protected $casts = ['tersembunyi' => 'array'];
}
