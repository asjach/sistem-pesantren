<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Preset kolom bawaan halaman Keanggotaan (`table_key='keanggotaan'`).
 *
 * Halaman Santri Per Lembaga menampilkan seluruh identitas santri + keanggotaan
 * (~70 kolom), sehingga butuh preset "ringkas" sebagai tampilan awal: identitas
 * santri dulu, lalu keanggotaan. Urutan & isi tetap bisa diubah super_admin
 * lewat Kelola tabel → tab Kolom.
 *
 * Idempoten: dilewati bila preset sudah ada. Sengaja di seeder (bukan migrasi)
 * agar tidak mengotori basis data pengujian.
 */
class PresetKolomSeeder extends Seeder
{
    /** Key kolom ringkas (harus sama dengan `fields` halaman Keanggotaan). */
    private const KOLOM = [
        // Identitas santri (Buku Induk).
        'nama', 'nik', 'nisn', 'jk', 'tmp_lahir', 'tgl_lahir', 'alamat',
        // Konteks lembaga.
        'lembaga',
        // Keanggotaan.
        'nis_lokal', 'nis_kemenag', 'aktif', 'masuk', 'selesai',
    ];

    public function run(): void
    {
        $ada = DB::table('preset_tabel')
            ->where('table_key', 'keanggotaan')
            ->where('nama', 'ringkas')
            ->exists();

        if ($ada) {
            return;
        }

        DB::table('preset_tabel')->insert([
            'jenjang' => null,
            'table_key' => 'keanggotaan',
            'nama' => 'ringkas',
            'kolom' => json_encode(self::KOLOM),
            'label' => null,
            'is_default' => true,
            'dibuat_oleh' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
