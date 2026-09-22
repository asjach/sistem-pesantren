<?php

namespace Database\Seeders;

use App\Models\Lembaga;
use Illuminate\Database\Seeder;

/**
 * Lembaga operasional = jenjang (kunci alami). Tanpa root/hierarki.
 *
 * Idempoten (`updateOrCreate` per jenjang). Dipanggil DatabaseSeeder (agar
 * `migrate:fresh --seed` selalu punya lembaga) dan DevSeeder — harus berjalan
 * sebelum AkunSeeder (admin lembaga butuh pivot) dan ReferensiSeeder (kamus
 * di-fan-out per lembaga).
 */
class LembagaSeeder extends Seeder
{
    public function run(): void
    {
        $daftar = [
            ['MI', 'Ibtidaiyah', 'combo_mi_md', false],
            ['MD', 'Diniyah', 'combo_mi_md', false],
            ['MTS', 'Tsanawiyah', 'eksklusif', true],
            ['MLN', "Mu'allimin", 'eksklusif', true],
        ];

        foreach ($daftar as [$jenjang, $nama, $kelompok, $seleksi]) {
            Lembaga::updateOrCreate(
                ['jenjang' => $jenjang],
                ['nama' => $nama, 'kelompok_psb' => $kelompok, 'is_seleksi' => $seleksi, 'is_active' => true],
            );
        }
    }
}
