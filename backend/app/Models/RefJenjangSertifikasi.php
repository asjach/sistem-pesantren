<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefJenjangSertifikasi extends Model
{
    protected $table = 'ref_jenjang_sertifikasi';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
