<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu pertemuan terjadwal: pengampu (kelas × mapel) pada hari + slot jam. */
class JadwalPelajaran extends Model
{
    public const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

    protected $table = 'jadwal_pelajaran';

    protected $guarded = ['id'];

    public function pengampuMapel(): BelongsTo
    {
        return $this->belongsTo(PengampuMapel::class);
    }

    public function slot(): BelongsTo
    {
        return $this->belongsTo(SlotJamPelajaran::class, 'slot_jam_id');
    }
}
