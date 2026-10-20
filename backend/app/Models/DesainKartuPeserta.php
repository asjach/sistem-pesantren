<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DesainKartuPeserta extends Model
{
    protected $table = 'desain_kartu_peserta';

    protected $fillable = [
        'jenjang', 'nama', 'elemen', 'warna_latar', 'gaya_latar', 'latar_path',
    ];

    protected $hidden = ['latar_path'];

    protected function casts(): array
    {
        return ['elemen' => 'array'];
    }

    /** @return BelongsTo<Lembaga, $this> */
    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    /** @return HasMany<PengaturanKartuPeserta, $this> */
    public function pengaturan(): HasMany
    {
        return $this->hasMany(PengaturanKartuPeserta::class, 'desain_id');
    }
}
