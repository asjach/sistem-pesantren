<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Minimal untuk kebutuhan ACC 100 (master penuh di 101): identitas stabil = id;
// NIK atribut tanpa unique, dedup nik+nama+tgl_lahir di service.
class Santri extends Model
{
    protected $table = 'santri';
    protected $guarded = ['id'];
    protected $casts = [
        'tgl_lahir' => 'date', 'tanggal_masuk' => 'date',
        'ayah_tgl_lahir' => 'date', 'ibu_tgl_lahir' => 'date', 'wali_tgl_lahir' => 'date',
        'status_global' => 'boolean',
    ];

    public function lembaga(): BelongsTo { return $this->belongsTo(Lembaga::class); }
    public function kelas(): BelongsTo { return $this->belongsTo(Kelas::class); }
    public function riwayatBelajar(): HasMany { return $this->hasMany(RiwayatBelajar::class, 'santri_id'); }
}
