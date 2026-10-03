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
            ['nama' => 'ASAS', 'tipe' => 'sekali'],
            ['nama' => 'ASAT', 'tipe' => 'sekali'],
            ['nama' => 'Ujian', 'tipe' => 'sekali'],
            ['nama' => 'HIPA', 'tipe' => 'sekali'],
            ['nama' => 'Pendaftaran', 'tipe' => 'sekali'],
            ['nama' => 'Biaya Masuk', 'tipe' => 'sekali'],
            ['nama' => 'Infaq Bulanan Asrama', 'tipe' => 'bulanan'],
        ];
        foreach ($jenis as $j) {
            JenisTagihan::firstOrCreate(['nama' => $j['nama']], $j + ['is_active' => true]);
        }
    }
}
