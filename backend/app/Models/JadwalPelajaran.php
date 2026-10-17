<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu pertemuan terjadwal: pengampu (kelas × mapel) pada hari + slot jam. */
class JadwalPelajaran extends Model
{
    public const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

    /**
     * Hari belajar (aktif) sebuah lembaga = semua hari dikurangi hari libur
     * mingguannya. Selalu minimal satu hari (Senin) agar matriks tak kosong
     * bila pengguna salah menandai semua hari libur.
     *
     * @param  list<string>|null  $hariLibur
     * @return list<string>
     */
    public static function hariAktif(?array $hariLibur): array
    {
        $libur = array_values(array_intersect(
            array_map(fn ($h) => mb_strtolower(trim((string) $h)), $hariLibur ?? []),
            self::HARI,
        ));
        $aktif = array_values(array_diff(self::HARI, $libur));

        return $aktif === [] ? ['senin'] : $aktif;
    }

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
