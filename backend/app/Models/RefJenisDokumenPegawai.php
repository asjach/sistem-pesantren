<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefJenisDokumenPegawai extends Model
{
    protected $table = 'ref_jenis_dokumen_pegawai';
    protected $fillable = ['lembaga_id', 'nama', 'urutan', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public $timestamps = false;
}
