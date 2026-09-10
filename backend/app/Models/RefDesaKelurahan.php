<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefDesaKelurahan extends Model
{
    protected $table = 'ref_desa_kelurahan';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
