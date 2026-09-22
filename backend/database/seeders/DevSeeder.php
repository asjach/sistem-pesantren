<?php

namespace Database\Seeders;

use App\Models\Lembaga;
use Illuminate\Database\Seeder;

class DevSeeder extends Seeder
{
    public function run(): void
    {
        // Lembaga dulu (AkunSeeder butuh pivot admin lembaga; ReferensiSeeder
        // mem-fan-out kamus per lembaga).
        $this->call([PermissionSeeder::class, LembagaSeeder::class, AkunSeeder::class, TahunAjaranSeeder::class, PresetKolomSeeder::class]);

        // Kamus per lembaga (tanpa baris global): benih nilai untuk lembaga di atas.
        $this->call([ReferensiSeeder::class]);

        $this->command?->info('DevSeeder: akun, '.Lembaga::count().' lembaga siap.');
    }
}
