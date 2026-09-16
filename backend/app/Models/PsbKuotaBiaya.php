<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PsbKuotaBiaya extends Model
{
    protected $table = 'psb_kuota_biaya';

    protected $guarded = ['id'];

    protected $casts = [
        'paket_tersedia' => 'boolean',
        'membutuhkan_seleksi' => 'boolean',
    ];

    public function gelombang(): BelongsTo
    {
        return $this->belongsTo(PsbGelombang::class, 'gelombang_id');
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class);
    }

    public function butuhSeleksi(): bool
    {
        // Override null = ikut default lembaga (root PRD Bab 2.2: is_seleksi).
        return $this->membutuhkan_seleksi ?? (bool) $this->lembaga->is_seleksi;
    }
}
