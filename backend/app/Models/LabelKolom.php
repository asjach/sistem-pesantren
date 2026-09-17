<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Kamus kolom level tabel database (global). Dipakai untuk menentukan nama
 * header, perataan, lebar, tooltip, dan format tampil sebuah kolom di SELURUH
 * halaman yang menampilkannya.
 */
class LabelKolom extends Model
{
    protected $table = 'label_kolom';

    protected $guarded = ['id'];

    protected $casts = [
        'lebar' => 'integer',
        'kunci_lebar' => 'boolean',
    ];
}
