<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Minimal untuk kebutuhan ACC 100 (lifecycle penuh di 102):
// is_active_riwayat === 'Ya' iff status_akhir='aktif', tulis hanya via service.
class RiwayatBelajar extends Model
{
    /** Nilai kanonis kolom keaktifan (ENUM). */
    public const YA = 'Ya';

    public const TIDAK = 'Tidak';

    protected $table = 'riwayat_belajar';

    protected $guarded = ['id'];

    /** Bawaan kolom keaktifan (juga menutup default DB saat rename di SQLite). */
    protected $attributes = ['is_active_riwayat' => self::YA];

    protected $casts = ['tgl_masuk' => 'date:Y-m-d', 'no_absen' => 'integer'];

    /** Keaktifan jejak akademik sebagai boolean (bandingkan string ENUM). */
    public function isActive(): bool
    {
        return $this->is_active_riwayat === self::YA;
    }

    public function santri(): BelongsTo
    {
        return $this->belongsTo(Santri::class);
    }

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class);
    }

    public function kelas(): BelongsTo
    {
        return $this->belongsTo(Kelas::class);
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }
}
