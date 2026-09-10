<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefStatusAkhir extends Model
{
    protected $table = 'ref_status_akhir';
    protected $fillable = ['lembaga_id', 'kode', 'label', 'is_aktif_bawaan', 'terminal_ke', 'urutan', 'is_active'];
    protected $casts = ['is_aktif_bawaan' => 'boolean', 'is_active' => 'boolean'];
    public $timestamps = false;
}
