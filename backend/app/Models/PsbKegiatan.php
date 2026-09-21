<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PsbKegiatan extends Model
{
    protected $table = 'psb_kegiatan';

    protected $guarded = ['id'];

    protected $casts = ['is_aktif' => 'boolean'];

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }

    public function gelombang(): HasMany
    {
        return $this->hasMany(PsbGelombang::class, 'psb_kegiatan_id');
    }
}
