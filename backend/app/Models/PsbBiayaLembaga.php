<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PsbBiayaLembaga extends Model
{
    protected $table = 'psb_biaya_lembaga';
    protected $guarded = ['id'];
    protected $casts = ['biaya_masuk' => 'decimal:2', 'biaya_asrama' => 'decimal:2'];

    public function lembaga(): BelongsTo { return $this->belongsTo(Lembaga::class); }
}
