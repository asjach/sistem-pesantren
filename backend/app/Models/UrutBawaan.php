<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Urut bawaan per endpoint daftar (sumber tunggal default sort). */
class UrutBawaan extends Model
{
    protected $table = 'urut_bawaan';

    protected $guarded = ['id'];

    protected $casts = ['kunci' => 'array'];
}
