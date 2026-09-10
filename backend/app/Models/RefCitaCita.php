<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefCitaCita extends Model
{
    protected $table = 'ref_cita_cita';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
