<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Preset kolom tampilan tabel; jenjang null = global (berlaku semua lembaga).
class PresetTabel extends Model
{
    protected $table = 'preset_tabel';

    protected $guarded = ['id'];

    /* `label` tak lagi di-cast: nama header kolom kini setelan per TABEL di
     * `toolbar_preset.label`, bukan per preset. */
    protected $casts = ['kolom' => 'array', 'is_default' => 'boolean'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
