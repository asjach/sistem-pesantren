<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Minimal untuk jahitan ACC 100 (transaksi penuh di 103):
// idempoten (santri,pos,periode); bayar total==sum + lockForUpdate.
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
    public function lembaga(): BelongsTo { return $this->belongsTo(Lembaga::class); }
}
