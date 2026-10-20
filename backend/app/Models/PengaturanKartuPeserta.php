<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PengaturanKartuPeserta extends Model
{
    protected $table = 'pengaturan_kartu_peserta';

    protected $fillable = [
        'peristiwa_id', 'desain_id', 'template_bawaan', 'lebar_mm', 'tinggi_mm',
    ];

    protected function casts(): array
    {
        return [
            'lebar_mm' => 'decimal:2',
            'tinggi_mm' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<PeristiwaNilai, $this> */
    public function peristiwa(): BelongsTo
    {
        return $this->belongsTo(PeristiwaNilai::class, 'peristiwa_id');
    }

    /** @return BelongsTo<DesainKartuPeserta, $this> */
    public function desain(): BelongsTo
    {
        return $this->belongsTo(DesainKartuPeserta::class, 'desain_id');
    }
}
