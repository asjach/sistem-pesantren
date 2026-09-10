<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Ketentuan dokumen wajib per lembaga (admin jenjang): mis. MI+MD hanya kk, MTs kk+ijazah.
class DokumenWajibLembaga extends Model
{
    protected $table = 'dokumen_wajib_lembaga';
    protected $guarded = ['id'];
    protected $casts = ['is_wajib' => 'boolean'];
    public function lembaga(): BelongsTo { return $this->belongsTo(Lembaga::class, 'lembaga_id'); }
}
