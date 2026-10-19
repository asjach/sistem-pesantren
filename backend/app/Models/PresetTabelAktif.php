<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PresetTabelAktif extends Model
{
    protected $table = 'preset_tabel_aktif';

    protected $guarded = ['id'];

    protected $casts = [
        'kolom' => 'array',
    ];

    public function preset(): BelongsTo
    {
        return $this->belongsTo(PresetTabel::class, 'preset_id');
    }
}
