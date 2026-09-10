<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Minimal untuk kebutuhan ACC 100 (lifecycle penuh di 102):
// is_aktif true iff status_akhir='aktif', tulis hanya via service.
class RiwayatBelajar extends Model
{
    protected $table = 'riwayat_belajar';
    protected $guarded = ['id'];
    protected $casts = ['tgl_masuk' => 'date', 'is_aktif' => 'boolean'];

    public function santri(): BelongsTo { return $this->belongsTo(Santri::class); }
    public function lembaga(): BelongsTo { return $this->belongsTo(Lembaga::class); }
    public function kelas(): BelongsTo { return $this->belongsTo(Kelas::class); }
    public function tahunAjaran(): BelongsTo { return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran_id'); }
}
