<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Mata pelajaran per jenjang (`kelompok`: formal | pesantren). Mapel lama
 * dinonaktifkan (`is_active=false`) alih-alih dihapus karena masih dirujuk baris
 * nilai/pengampu.
 */
class MataPelajaran extends Model
{
    public const FORMAL = 'formal';

    public const PESANTREN = 'pesantren';

    protected $table = 'mata_pelajaran';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function kurikulumMapel(): HasMany
    {
        return $this->hasMany(KurikulumMapel::class);
    }

    public function pengampu(): HasMany
    {
        return $this->hasMany(PengampuMapel::class);
    }
}
