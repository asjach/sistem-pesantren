<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Minimal untuk kebutuhan 100/203 (relasi wali-anak + cek pemilik portal).
class WaliSantriRelasi extends Model
{
    protected $table = 'wali_santri_relasi';
    protected $guarded = ['id'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function santri(): BelongsTo { return $this->belongsTo(Santri::class); }
}
