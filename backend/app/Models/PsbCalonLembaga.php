<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PsbCalonLembaga extends Model
{
    protected $table = 'psb_calon_lembaga';
    protected $guarded = ['id'];

    public function calon(): BelongsTo { return $this->belongsTo(PsbCalonSantri::class, 'psb_calon_santri_id'); }
    public function lembaga(): BelongsTo { return $this->belongsTo(Lembaga::class); }
}
