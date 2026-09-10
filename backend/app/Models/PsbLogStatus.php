<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PsbLogStatus extends Model
{
    protected $table = 'psb_log_status';
    protected $guarded = ['id'];
    public function calon(): BelongsTo { return $this->belongsTo(PsbCalonSantri::class, 'psb_calon_santri_id'); }
}
