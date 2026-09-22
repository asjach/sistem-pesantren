<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefWaktuTempuh extends Model
{
    protected $table = 'ref_waktu_tempuh';

    protected $fillable = ['jenjang', 'nama', 'urutan', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public $timestamps = false;
}
