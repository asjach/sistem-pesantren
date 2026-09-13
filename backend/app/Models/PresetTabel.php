<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Preset kolom tampilan tabel; lembaga_id null = global (berlaku semua lembaga).
class PresetTabel extends Model
{
    protected $table = 'preset_tabel';
    protected $guarded = ['id'];
    protected $casts = ['kolom' => 'array'];

    public function lembaga(): BelongsTo { return $this->belongsTo(Lembaga::class, 'lembaga_id'); }
    public function pembuat(): BelongsTo { return $this->belongsTo(User::class, 'dibuat_oleh'); }
}
