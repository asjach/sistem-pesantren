<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefYangMembiayai extends Model
{
    protected $table = 'ref_yang_membiayai';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
