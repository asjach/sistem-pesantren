<?php

namespace Database\Seeders;

use App\Models\Lembaga;
use App\Models\TahunAjaran;
use Illuminate\Database\Seeder;

class DevSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(AkunSeeder::class);

        $root = Lembaga::firstOrCreate(
            ['kode' => 'PESANTREN'],
            ['nama' => 'Pesantren', 'is_seleksi' => false, 'kelompok_psb' => 'eksklusif', 'is_active' => true],
        );
        $root->update(['kelompok_psb' => 'eksklusif']);

        $mi = Lembaga::firstOrCreate(
            ['kode' => 'MI'],
            ['parent_id' => $root->id, 'nama' => 'Ibtidaiyah', 'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true],
        );
        $md = Lembaga::firstOrCreate(
            ['kode' => 'MD'],
            ['parent_id' => $root->id, 'nama' => 'Diniyah', 'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true],
        );
        $mts = Lembaga::firstOrCreate(
            ['kode' => 'MTS'],
            ['parent_id' => $root->id, 'nama' => 'Tsanawiyah', 'is_seleksi' => true, 'kelompok_psb' => 'eksklusif', 'is_active' => true],
        );
        $mln = Lembaga::firstOrCreate(
            ['kode' => 'MLN'],
            ['parent_id' => $root->id, 'nama' => "Mu'allimin", 'is_seleksi' => true, 'kelompok_psb' => 'eksklusif', 'is_active' => true],
        );
        foreach ([$mi, $md] as $l) {
            $l->update(['kelompok_psb' => 'combo_mi_md']);
        }
        foreach ([$mts, $mln] as $l) {
            $l->update(['kelompok_psb' => 'eksklusif']);
        }

        // TA data pesantren (global, `lembaga_id` NULL) dan hanya satu yang aktif.
        $ta = TahunAjaran::firstOrCreate(
            ['lembaga_id' => null, 'nama' => '2026/2027'],
            ['tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_active' => true],
        );
        $ta->update(['tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_active' => true]);
        TahunAjaran::where('id', '!=', $ta->id)->update(['is_aktif' => false]);
        TahunAjaran::where('id', $ta->id)->update(['is_aktif' => true]);

        $this->command?->info('DevSeeder: akun, '.Lembaga::count().' lembaga, TA '.$ta->nama.' siap.');
    }
}
