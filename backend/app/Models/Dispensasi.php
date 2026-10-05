<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Appends;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Paket dispensasi (keringanan) tagihan: N aturan per jenis tagihan +
 * daftar santri penerima. Cocok bila santri ada di pivot.
 */
#[Appends(['santri_ids'])]
class Dispensasi extends Model
{
    protected $table = 'dispensasi';

    protected $fillable = [
        'nama', 'keterangan', 'tahun_ajaran', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /** Aturan potongan per jenis tagihan. */
    public function aturan(): HasMany
    {
        return $this->hasMany(DispensasiAturan::class, 'dispensasi_id');
    }

    /** Santri penerima via pivot `santri_dispensasi`. */
    public function santriTambahan(): BelongsToMany
    {
        return $this->belongsToMany(Santri::class, 'santri_dispensasi', 'dispensasi_id', 'santri_id')
            ->withTimestamps();
    }

    /**
     * Kompatibilitas API: `santri_ids` tetap diserialkan (null bila kosong,
     * seperti kolom JSON sebelumnya).
     *
     * @return Attribute<list<int>|null, never>
     */
    protected function santriIds(): Attribute
    {
        return Attribute::get(function (): ?array {
            $ids = $this->relationLoaded('santriTambahan')
                ? $this->santriTambahan->pluck('id')->map(fn ($id) => (int) $id)
                : $this->santriTambahan()->allRelatedIds()->map(fn ($id) => (int) $id);

            $unik = $ids->unique()->sort()->values()->all();

            return $unik === [] ? null : $unik;
        });
    }
}
