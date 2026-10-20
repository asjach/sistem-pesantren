<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Snapshot versi jadwal pelajaran untuk satu lembaga + tahun ajaran.
 *
 * `snapshot` menyimpan salinan slot, pengampu, dan sel jadwal dengan kunci
 * alami agar bisa dipulihkan tanpa bergantung pada id baris. Hanya satu varian
 * berstatus aktif per jenjang + tahun ajaran.
 */
class VarianJadwal extends Model
{
    protected $table = 'varian_jadwal';

    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean', 'snapshot' => 'array'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function tahunAjaran(): BelongsTo
    {
        return $this->belongsTo(TahunAjaran::class, 'tahun_ajaran', 'nama');
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }

    /**
     * Ringkasan isi snapshot untuk ditampilkan di riwayat.
     *
     * @return array{kelas:int, slot:int, pengampu:int, jadwal:int}
     */
    public function ringkasan(): array
    {
        $kelas = $this->snapshot['kelas'] ?? [];
        $slot = 0;
        $pengampu = 0;
        $jadwal = 0;

        foreach ($kelas as $k) {
            $slot += count($k['slot'] ?? []);
            $pengampu += count($k['pengampu'] ?? []);
            $jadwal += count($k['jadwal'] ?? []);
        }

        return ['kelas' => count($kelas), 'slot' => $slot, 'pengampu' => $pengampu, 'jadwal' => $jadwal];
    }
}
