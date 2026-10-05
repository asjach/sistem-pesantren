<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Appends;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** Dispensasi (keringanan) tagihan: target kriteria akademik atau santri tertentu. */
#[Appends(['santri_ids'])]
class Dispensasi extends Model
{
    protected $table = 'dispensasi';

    protected $fillable = [
        'nama', 'keterangan', 'tahun_ajaran', 'jenis_id', 'paket', 'tingkat',
        'kelas_id', 'tipe', 'nilai', 'prioritas', 'is_active',
    ];

    protected $casts = [
        'paket' => 'array',
        'tingkat' => 'array',
        'kelas_id' => 'array',
        'nilai' => 'integer',
        'prioritas' => 'integer',
        'is_active' => 'boolean',
    ];

    public function jenis(): BelongsTo
    {
        return $this->belongsTo(JenisTagihan::class, 'jenis_id');
    }

    /** Santri tambahan individual via pivot `santri_dispensasi`. */
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
