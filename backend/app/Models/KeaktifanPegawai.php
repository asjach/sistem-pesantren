<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Penugasan pegawai per lembaga + tahun ajaran (status aktif/inaktif). */
class KeaktifanPegawai extends Model
{
    protected $table = 'keaktifan_pegawai';

    protected $guarded = ['id'];

    public const AKTIF = 'aktif';

    public function pegawai(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class, 'pegawai_id');
    }
}
