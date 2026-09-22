<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefPenghasilan extends Model
{
    protected $table = 'ref_penghasilan';

    protected $fillable = ['jenjang', 'nama', 'urutan', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public $timestamps = false;
}
