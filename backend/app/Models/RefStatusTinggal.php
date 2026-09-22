<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefStatusTinggal extends Model
{
    protected $table = 'ref_status_tinggal';

    protected $fillable = ['jenjang', 'nama', 'urutan', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public $timestamps = false;
}
