<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefJalurSertifikasi extends Model
{
    protected $table = 'ref_jalur_sertifikasi';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
