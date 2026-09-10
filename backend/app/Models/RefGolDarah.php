<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefGolDarah extends Model
{
    protected $table = 'ref_gol_darah';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
