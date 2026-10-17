<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Pengampu mata pelajaran per kelas (guru pengampu). Sumber nama guru di rapor
 * dan kunci `nilai_santri`/`nilai_komponen` (unik kelas × mapel).
 */
class PengampuMapel extends Model
{
    protected $table = 'pengampu_mapel';

    protected $guarded = ['id'];

    protected $casts = ['jp_per_minggu' => 'integer'];

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

    public function jadwal(): HasMany
    {
        return $this->hasMany(JadwalPelajaran::class);
    }
}
