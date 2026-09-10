<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefMetodePembayaran extends Model
{
    protected $table = 'ref_metode_pembayaran';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
