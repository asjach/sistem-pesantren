<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Minimal untuk kebutuhan 100/203 (pengajuan revisi biodata, maks 1 aktif/santri).
class PengajuanBiodataSantri extends Model
{
    protected $table = 'pengajuan_biodata_santri';
    protected $guarded = ['id'];
    protected $casts = ['cancelled_at' => 'datetime', 'perubahan_json' => 'array'];

    public function santri(): BelongsTo { return $this->belongsTo(Santri::class); }
    public function wali(): BelongsTo { return $this->belongsTo(User::class, 'wali_user_id'); }
}
