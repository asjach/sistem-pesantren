<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Riwayat keaktifan pegawai per lembaga + tahun ajaran (konsep `riwayat_keaktifan_pegawai`). */
class KeaktifanPegawai extends Model
{
    protected $table = 'keaktifan_pegawai';

    protected $guarded = ['id'];

    protected $casts = [
        'tgl_sk' => 'date:Y-m-d',
    ];

    public const AKTIF = 'aktif';

    public const INAKTIF = 'inaktif';

    public function pegawai(): BelongsTo
    {
        return $this->belongsTo(Pegawai::class, 'pegawai_id');
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }
}
