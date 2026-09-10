<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TarifBiaya extends Model
{
    protected $table = 'tarif_biaya';

    protected $fillable = [
        'pos_keuangan_id', 'lembaga_id', 'tahun_ajaran_id',
        'tipe_santri', 'nominal', 'nominal_paket',
    ];

    protected function casts(): array
    {
        return ['nominal' => 'decimal:2', 'nominal_paket' => 'decimal:2'];
    }

    public function pos(): BelongsTo
    {
        return $this->belongsTo(PosKeuangan::class, 'pos_keuangan_id');
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class);
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class);
    }
}
