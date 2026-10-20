<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PengaturanNomorPeserta extends Model
{
    public const PER_TINGKAT = 'per_tingkat';

    public const SEMUA_TINGKAT = 'semua_tingkat';

    protected $table = 'pengaturan_nomor_peserta';

    protected $fillable = [
        'peristiwa_id',
        'semester',
        'template',
        'mode_urutan',
    ];

    /** @return BelongsTo<PeristiwaNilai, $this> */
    public function peristiwa(): BelongsTo
    {
        return $this->belongsTo(PeristiwaNilai::class, 'peristiwa_id');
    }
}
