<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tagihan extends Model
{
    protected $table = 'tagihan';

    protected $guarded = ['id'];

    protected $casts = [
        'nominal' => 'integer',
        'potongan' => 'integer',
        'terbayar' => 'integer',
        'jatuh_tempo' => 'date',
        'dispensasi_ids' => 'array',
    ];

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }

    public function jenis(): BelongsTo
    {
        return $this->belongsTo(JenisTagihan::class, 'jenis_id');
    }

    public function pembayaran(): HasMany
    {
        return $this->hasMany(Pembayaran::class);
    }

    public function sisa(): int
    {
        return max(0, (int) $this->nominal - (int) $this->terbayar);
    }

    /**
     * Tunggakan: masih ada sisa DAN sudah lewat batas waktunya.
     *
     * - Ada jatuh tempo → terlambat setelah tanggal itu lewat (tepat hari itu belum).
     * - Tanpa jatuh tempo (jenis non-bulanan yang tidak diisi manual) → langsung
     *   dianggap tunggakan, sebab tidak ada batas waktunya sama sekali.
     */
    public function terlambat(): bool
    {
        if ($this->sisa() <= 0) {
            return false;
        }

        return $this->jatuh_tempo === null || $this->jatuh_tempo->lt(today());
    }

    /** Sisa tagihan yang masuk hitungan tunggakan (0 bila belum terlambat). */
    public function sisaTerlambat(): int
    {
        return $this->terlambat() ? $this->sisa() : 0;
    }
}
