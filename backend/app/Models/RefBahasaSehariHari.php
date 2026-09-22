<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefBahasaSehariHari extends Model
{
    protected $table = 'ref_bahasa_sehari_hari';

    protected $fillable = ['jenjang', 'nama', 'urutan', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public $timestamps = false;
}
