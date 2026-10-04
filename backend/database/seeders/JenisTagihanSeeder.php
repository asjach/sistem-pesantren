<?php

namespace Database\Seeders;

use App\Models\JenisTagihan;
use Illuminate\Database\Seeder;

/** Jenis tagihan dasar (bisa ditambah pengguna). */
class JenisTagihanSeeder extends Seeder
{
    public function run(): void
    {
        $jenis = [
            ['nama' => 'Infaq Bulanan', 'tipe' => 'bulanan'],
            ['nama' => 'ASAS', 'tipe' => 'non_bulanan'],
            ['nama' => 'ASAT', 'tipe' => 'non_bulanan'],
            ['nama' => 'Ujian', 'tipe' => 'non_bulanan'],
            ['nama' => 'HIPA', 'tipe' => 'non_bulanan'],
            ['nama' => 'Pendaftaran', 'tipe' => 'non_bulanan'],
            ['nama' => 'Biaya Masuk', 'tipe' => 'non_bulanan'],
            ['nama' => 'Infaq Bulanan Asrama', 'tipe' => 'bulanan'],
        ];
        foreach ($jenis as $j) {
            JenisTagihan::firstOrCreate(['nama' => $j['nama']], $j + ['is_active' => true]);
        }
    }
}
