<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefKebutuhanKhusus extends Model
{
    protected $table = 'ref_kebutuhan_khusus';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
