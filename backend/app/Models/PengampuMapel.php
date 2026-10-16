<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pengampu mata pelajaran per kelas (guru pengampu). Sumber nama guru di rapor
 * dan kunci `nilai_santri`/`nilai_komponen` (unik kelas × mapel).
 */
class PengampuMapel extends Model
{
    protected $table = 'pengampu_mapel';

    protected $guarded = ['id'];

    public function kelas(): BelongsTo
    {
        return $this->belongsTo(Kelas::class);
    }

    public function mataPelajaran(): BelongsTo
    {
        return $this->belongsTo(MataPelajaran::class);
    }

    public function keaktifan(): BelongsTo
    {
        return $this->belongsTo(KeaktifanPegawai::class, 'keaktifan_pegawai_id');
    }
}
