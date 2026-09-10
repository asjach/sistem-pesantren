<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Diperluas 103-B: relasi posKeuangan + pembayaranDetail (dipakai generate/bayar/kuitansi).
// Relasi lama calon() dipertahankan (kompatibilitas); psbCalonSantri() = alias spec 103.
class Tagihan extends Model
{
    protected $table = 'tagihan';
    protected $guarded = ['id'];
    protected $casts = [
        'nominal_total' => 'decimal:2',
        'nominal_terbayar' => 'decimal:2',
        'sisa_tagihan' => 'decimal:2',
    ];

    public function santri(): BelongsTo { return $this->belongsTo(Santri::class); }
    public function calon(): BelongsTo { return $this->belongsTo(PsbCalonSantri::class, 'psb_calon_santri_id'); }
    public function psbCalonSantri(): BelongsTo { return $this->belongsTo(PsbCalonSantri::class, 'psb_calon_santri_id'); }
    public function posKeuangan(): BelongsTo { return $this->belongsTo(PosKeuangan::class, 'pos_keuangan_id'); }
    public function pembayaranDetail(): HasMany { return $this->hasMany(PembayaranDetail::class, 'tagihan_id'); }
    public function lembaga(): BelongsTo { return $this->belongsTo(Lembaga::class); }
}
