<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefAlamat extends Model
{
    protected $table = 'ref_alamat';
    protected $fillable = ['lembaga_id', 'nama', 'provinsi', 'kab_kota', 'kecamatan', 'desa_kelurahan', 'alamat', 'rt', 'rw', 'kode_pos', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
