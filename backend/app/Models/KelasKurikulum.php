<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Pivot kelas → kurikulum (satu kelas boleh memakai beberapa kurikulum). */
class KelasKurikulum extends Model
{
    protected $table = 'kelas_kurikulum';

    protected $guarded = ['id'];

    public function kelas(): BelongsTo
    {
        return $this->belongsTo(Kelas::class);
    }

    public function kurikulum(): BelongsTo
    {
        return $this->belongsTo(Kurikulum::class);
    }
}
