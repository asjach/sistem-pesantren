<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Setelan komponen CUSTOM (LabeledCombobox, LabeledTextInput, dst): satu
 * baris per komponen, kunci = `table_key` + `komponen` (htmlFor).
 *
 * Berbeda dengan `ToolbarPreset`, kolom `setelan` JSON bebas kunci baru:
 * menambah setelan cukup menambah aturan validasi, tanpa migrasi.
 * `table_key` string kosong = komponen di luar tabel (dialog/form/popover).
 */
class KomponenCustom extends Model
{
    protected $table = 'komponen_custom';

    protected $fillable = ['table_key', 'komponen', 'setelan', 'dibuat_oleh'];

    protected $casts = [
        'setelan' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function dibuatOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}