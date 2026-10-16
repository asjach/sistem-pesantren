<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Master predikat ekstrakurikuler → deskripsi. `jenjang` null = berlaku semua
 * lembaga. Bawaan: A Sangat Baik, B Baik, C Cukup, D Kurang, E Kurang Sekali.
 */
class PredikatEkskul extends Model
{
    protected $table = 'predikat_ekskul';

    protected $guarded = ['id'];

    protected $casts = ['urutan' => 'integer'];
}
