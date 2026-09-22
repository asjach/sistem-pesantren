<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Preset kolom tampilan tabel; jenjang null = global (berlaku semua lembaga).
class PresetTabel extends Model
{
    protected $table = 'preset_tabel';

    protected $guarded = ['id'];

    protected $casts = ['kolom' => 'array', 'label' => 'array', 'is_default' => 'boolean'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
