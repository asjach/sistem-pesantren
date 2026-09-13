<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Pilihan preset terakhir per user per tabel (null = Lengkap).
class PresetTabelAktif extends Model
{
    protected $table = 'preset_tabel_aktif';
    protected $guarded = ['id'];

    public function preset(): BelongsTo { return $this->belongsTo(PresetTabel::class, 'preset_id'); }
}
