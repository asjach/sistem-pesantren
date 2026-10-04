<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Dispensasi (keringanan) tagihan: target kriteria akademik atau santri tertentu. */
class Dispensasi extends Model
{
    protected $table = 'dispensasi';

    protected $fillable = [
        'nama', 'keterangan', 'tahun_ajaran', 'jenis_id', 'paket', 'tingkat',
        'kelas_id', 'santri_ids', 'tipe', 'nilai', 'prioritas', 'is_active',
    ];

    protected $casts = [
        'paket' => 'array',
        'tingkat' => 'array',
        'kelas_id' => 'array',
        'santri_ids' => 'array',
        'nilai' => 'integer',
        'prioritas' => 'integer',
        'is_active' => 'boolean',
    ];

    public function jenis(): BelongsTo
    {
        return $this->belongsTo(JenisTagihan::class, 'jenis_id');
    }
}
