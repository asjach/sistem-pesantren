<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Mata pelajaran per jenjang (`kelompok`: formal | pesantren). */
class MataPelajaran extends Model
{
    protected $table = 'mata_pelajaran';

    protected $guarded = ['id'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }
}
