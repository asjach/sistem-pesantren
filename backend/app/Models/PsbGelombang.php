<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PsbGelombang extends Model
{
    protected $table = 'psb_gelombang';
    protected $guarded = ['id'];
    protected $casts = ['tgl_buka' => 'date', 'tgl_tutup' => 'date'];

    public function kegiatan(): BelongsTo { return $this->belongsTo(PsbKegiatan::class, 'psb_kegiatan_id'); }
    public function kuotaBiaya(): HasMany { return $this->hasMany(PsbKuotaBiaya::class, 'gelombang_id'); }
    public function calon(): HasMany { return $this->hasMany(PsbCalonSantri::class, 'gelombang_id'); }
}
