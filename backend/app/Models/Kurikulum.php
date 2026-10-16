<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Kurikulum per jenjang (mis. "Kurikulum Kemenag", "Kurikulum Pesantren").
 * MTS/MLN bisa punya dua kurikulum yang digabung; kelas dipetakan lewat
 * `kelas_kurikulum`, daftar mapelnya lewat `kurikulum_mapel`.
 */
class Kurikulum extends Model
{
    protected $table = 'kurikulum';

    protected $guarded = ['id'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function mapel(): HasMany
    {
        return $this->hasMany(KurikulumMapel::class)->orderBy('urutan');
    }

    public function kelas(): BelongsToMany
    {
        return $this->belongsToMany(Kelas::class, 'kelas_kurikulum');
    }
}
