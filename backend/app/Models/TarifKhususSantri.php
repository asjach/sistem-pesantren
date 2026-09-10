<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TarifKhususSantri extends Model
{
    protected $table = 'tarif_khusus_santri';
    protected $guarded = ['id'];
    protected $casts = ['nominal_diskon' => 'decimal:2', 'nominal_akhir' => 'decimal:2'];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }

    public function posKeuangan(): BelongsTo
    {
        return $this->belongsTo(PosKeuangan::class, 'pos_keuangan_id');
    }
}
