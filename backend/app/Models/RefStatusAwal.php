<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefStatusAwal extends Model
{
    protected $table = 'ref_status_awal';
    protected $fillable = ['lembaga_id', 'kode', 'label', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
