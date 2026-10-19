<?php

namespace Database\Seeders;

use App\Models\Lembaga;
use Illuminate\Database\Seeder;

class DevSeeder extends Seeder
{
    public function run(): void
    {

        $this->call([PermissionSeeder::class, LembagaSeeder::class, AkunSeeder::class, TahunAjaranSeeder::class, PresetKolomSeeder::class]);

        $this->call([ReferensiSeeder::class]);

        $this->command?->info('DevSeeder: akun, '.Lembaga::count().' lembaga siap.');
    }
}
