<?php

namespace Database\Seeders;

use App\Models\TahunAjaran;
use Illuminate\Database\Seeder;

/**
 * Tahun ajaran global (data pesantren) dari 1990/1991 s.d. 2026/2027.
 * Rentang satu TA: 1 Juli (tahun awal) s.d. 30 Juni (tahun akhir).
 * Hanya TA terakhir yang aktif.
 */
class TahunAjaranSeeder extends Seeder
{
    public const TAHUN_AWAL = 1990;

    public const TAHUN_AKHIR = 2026;

    public function run(): void
    {
        for ($tahun = self::TAHUN_AWAL; $tahun <= self::TAHUN_AKHIR; $tahun++) {
            TahunAjaran::updateOrCreate(
                ['nama' => $tahun.'/'.($tahun + 1)],
                [
                    'tanggal_mulai' => $tahun.'-07-01',
                    'tanggal_selesai' => ($tahun + 1).'-06-30',
                    'is_aktif' => $tahun === self::TAHUN_AKHIR,
                ],
            );
        }

        $this->command?->info('TahunAjaranSeeder: '.TahunAjaran::count().' tahun ajaran siap.');
    }
}
