<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Diperluas 103-B: relasi detail + akunKas + santri (+calon/kasir).
// CATATAN: relasi lama tagihan() (belongsTo tanpa kolom tagihan_id) DIHAPUS —
// pembayaran menempel ke banyak tagihan via pembayaran_detail, bukan kolom langsung.
class Pembayaran extends Model
{
    protected $table = 'pembayaran';
    protected $guarded = ['id'];
    protected $casts = ['tgl_pembayaran' => 'datetime', 'total_bayar' => 'decimal:2'];

    public function detail(): HasMany { return $this->hasMany(PembayaranDetail::class, 'pembayaran_id'); }
    public function akunKas(): BelongsTo { return $this->belongsTo(AkunKas::class, 'akun_kas_id'); }
    public function santri(): BelongsTo { return $this->belongsTo(Santri::class); }
    public function psbCalonSantri(): BelongsTo { return $this->belongsTo(PsbCalonSantri::class, 'psb_calon_santri_id'); }
    public function kasir(): BelongsTo { return $this->belongsTo(User::class, 'user_id'); }
}
