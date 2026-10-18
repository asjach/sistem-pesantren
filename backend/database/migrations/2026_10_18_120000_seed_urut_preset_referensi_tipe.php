<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Opsi urut bawaan dropdown Urutkan untuk daftar TIPE kamus (kolom kiri
     * halaman Referensi).
     *
     * Tanpa baris ini dropdown Urutkan tak dirender sama sekali (komponennya
     * menyembunyikan diri saat tabel belum punya opsi), sehingga bilah judul
     * tabel kamus hanya berisi judul + gerigi. Kode `tipe` WAJIB ada di
     * `UrutKatalog::PETA['referensi_tipe']`; pengurutannya dijalankan di KLIEN
     * karena daftar tipe datang dari `referensi/types` (array kunci, bukan
     * paginasi).
     */
    public function up(): void
    {
        $opsi = [
            [
                'kode' => ['tipe'],
                'label' => 'Tipe',
                'arah' => null,
                'bawaan' => false,
            ],
        ];

        $sekarang = now();
        DB::table('urut_preset')->updateOrInsert(
            ['table_key' => 'referensi_tipe'],
            ['opsi' => json_encode($opsi), 'created_at' => $sekarang, 'updated_at' => $sekarang],
        );
    }

    public function down(): void
    {
        DB::table('urut_preset')->where('table_key', 'referensi_tipe')->delete();
    }
};
