<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefPekerjaan extends Model
{
    protected $table = 'ref_pekerjaan';

    protected $fillable = ['jenjang', 'nama', 'urutan', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public $timestamps = false;
}
