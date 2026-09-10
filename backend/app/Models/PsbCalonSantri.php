<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PsbCalonSantri extends Model
{
    protected $table = 'psb_calon_santri';
    protected $guarded = ['id'];
    protected $casts = [
        'tgl_lahir' => 'date', 'tanggal_daftar' => 'date', 'tanggal_masuk' => 'date',
        'ayah_tgl_lahir' => 'date', 'ibu_tgl_lahir' => 'date', 'wali_tgl_lahir' => 'date',
        'is_pendaftaran_paid' => 'boolean', 'is_daftar_ulang_paid' => 'boolean',
        'is_duplikat_kontak' => 'boolean', 'is_lanjutan' => 'boolean',
        'is_pindahan' => 'boolean',
    ];

    public function gelombang(): BelongsTo { return $this->belongsTo(PsbGelombang::class, 'gelombang_id'); }
    public function lembagaTujuan(): BelongsTo { return $this->belongsTo(Lembaga::class, 'lembaga_id'); }
    public function santriAsal(): BelongsTo { return $this->belongsTo(Santri::class, 'santri_asal_id'); }
    public function santriHasil(): BelongsTo { return $this->belongsTo(Santri::class, 'santri_id'); }
    public function berkas(): HasMany { return $this->hasMany(DokumenSantri::class, 'psb_calon_santri_id'); }
    public function logStatus(): HasMany { return $this->hasMany(PsbLogStatus::class, 'psb_calon_santri_id'); }
    public function tagihan(): HasMany { return $this->hasMany(Tagihan::class, 'psb_calon_santri_id'); }
}
