<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PosKeuangan extends Model
{
    protected $table = 'pos_keuangan';

    protected $fillable = [
        'kode_pos', 'nama_pos', 'tipe', 'keterangan',
    ];

    public function tarif(): HasMany
    {
        return $this->hasMany(TarifBiaya::class);
    }
}
