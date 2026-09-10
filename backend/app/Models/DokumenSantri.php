<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Pengganti psb_berkas (dilebur): milik calon SEBELUM acc, pindah ke santri SAAT acc.
class DokumenSantri extends Model
{
    protected $table = 'dokumen_santri';
    protected $guarded = ['id'];
    protected $casts = ['status_verifikasi' => 'string'];
    public function calon(): BelongsTo { return $this->belongsTo(PsbCalonSantri::class, 'psb_calon_santri_id'); }
    public function santri(): BelongsTo { return $this->belongsTo(Santri::class, 'santri_id'); }
}
