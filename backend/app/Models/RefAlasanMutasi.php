<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefAlasanMutasi extends Model
{
    protected $table = 'ref_alasan_mutasi';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
