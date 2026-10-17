<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Slot jam pelajaran per jenjang (mis. "Jam 1" 07:00–07:45). */
class SlotJamPelajaran extends Model
{
    public const JENIS = ['pelajaran', 'istirahat', 'pembiasaan'];

    protected $table = 'slot_jam_pelajaran';

    protected $guarded = ['id'];

    protected $casts = ['urutan' => 'integer'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function kelas(): BelongsTo
    {
        return $this->belongsTo(Kelas::class);
    }

    public function jadwal(): HasMany
    {
        return $this->hasMany(JadwalPelajaran::class, 'slot_jam_id');
    }
}
