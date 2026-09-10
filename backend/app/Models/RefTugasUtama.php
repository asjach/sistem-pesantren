<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefTugasUtama extends Model
{
    protected $table = 'ref_tugas_utama';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
