<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Pilihan preset terakhir per user per tabel (null = Lengkap).
//
// Saat `preset_id` null, `kolom` menyimpan susunan "Lengkap kustom"
// (mis. sebagian kolom disembunyikan) supaya bertahan antar muat ulang.
class PresetTabelAktif extends Model
{
    protected $table = 'preset_tabel_aktif';

    protected $guarded = ['id'];

    /* `label` tak lagi di-cast: nama header kolom per TABEL di
     * `toolbar_preset.label`. Kolom DB-nya masih ada tapi selalu null. */
    protected $casts = [
        'kolom' => 'array',
    ];

    public function preset(): BelongsTo
    {
        return $this->belongsTo(PresetTabel::class, 'preset_id');
    }
}
