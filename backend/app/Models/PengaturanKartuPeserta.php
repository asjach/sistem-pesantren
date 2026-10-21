<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PengaturanKartuPeserta extends Model
{
    protected $table = 'pengaturan_kartu_peserta';

    protected $fillable = [
        'kegiatan_evaluatif_id', 'desain_id', 'template_bawaan', 'lebar_mm', 'tinggi_mm',
    ];

    protected function casts(): array
    {
        return [
            'lebar_mm' => 'decimal:2',
            'tinggi_mm' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<KegiatanEvaluatif, $this> */
    public function kegiatanEvaluatif(): BelongsTo
    {
        return $this->belongsTo(KegiatanEvaluatif::class, 'kegiatan_evaluatif_id');
    }

    /** @return BelongsTo<DesainKartuPeserta, $this> */
    public function desain(): BelongsTo
    {
        return $this->belongsTo(DesainKartuPeserta::class, 'desain_id');
    }
}
