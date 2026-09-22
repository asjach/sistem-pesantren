<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefHobi extends Model
{
    protected $table = 'ref_hobi';

    protected $fillable = ['jenjang', 'nama', 'urutan', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public $timestamps = false;
}
