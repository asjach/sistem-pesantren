<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefTingkat extends Model
{
    protected $table = 'ref_tingkat';

    protected $fillable = ['jenjang', 'nama', 'urutan', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public $timestamps = false;
}
