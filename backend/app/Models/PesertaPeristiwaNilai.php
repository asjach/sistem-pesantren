<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PesertaPeristiwaNilai extends Model
{
    public const MANUAL = 'manual';

    public const OTOMATIS = 'otomatis';

    protected $table = 'peserta_peristiwa_nilai';

    protected $fillable = [
        'peristiwa_id',
        'santri_id',
        'semester',
        'nomor_peserta',
        'sumber_nomor',
    ];

    /** @return BelongsTo<PeristiwaNilai, $this> */
    public function peristiwa(): BelongsTo
    {
        return $this->belongsTo(PeristiwaNilai::class, 'peristiwa_id');
    }

    /** @return BelongsTo<Santri, $this> */
    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }
}
