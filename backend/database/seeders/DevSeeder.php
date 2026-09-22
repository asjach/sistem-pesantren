<?php

namespace Database\Seeders;

use App\Models\Lembaga;
use Illuminate\Database\Seeder;

class DevSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([PermissionSeeder::class, AkunSeeder::class]);

        // Lembaga = jenjang (kunci alami). Tanpa root/hierarki.
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

        // Kamus per lembaga (tanpa baris global): benih nilai untuk lembaga di atas.
        $this->call([ReferensiSeeder::class]);

        $this->command?->info('DevSeeder: akun, '.Lembaga::count().' lembaga siap.');
    }
}
