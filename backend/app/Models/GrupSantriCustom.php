<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class GrupSantriCustom extends Model
{
    protected $table = 'grup_santri_custom';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];

    public function scopeTenantScope(Builder $query): Builder
    {
        $actor = auth()->user();

        return $actor->bolehPesantren() ? $query : $query->whereIn('jenjang', $actor->lembagaIdsDenganPasangan());
    }

    /** Anggota grup (santri pilihan manual). */
    public function santri(): BelongsToMany
    {
        return $this->belongsToMany(Santri::class, 'anggota_grup_santri_custom', 'grup_id', 'santri_id')
            ->withTimestamps();
    }
}
