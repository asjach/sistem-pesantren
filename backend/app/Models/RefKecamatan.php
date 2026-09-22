<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefKecamatan extends Model
{
    protected $table = 'ref_kecamatan';

    protected $fillable = ['jenjang', 'nama', 'urutan', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public $timestamps = false;
}
