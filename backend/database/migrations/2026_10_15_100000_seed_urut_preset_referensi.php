<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Opsi urut bawaan dropdown Urutkan halaman Referensi.
     *
     * Kodenya WAJIB ada di `UrutKatalog::PETA['referensi']` — validasi token
     * `sort` memakai allowlist itu. Urutannya sendiri diterapkan di KLIEN
     * (halaman memuat seluruh baris sekaligus, endpoint-nya bukan paginasi),
     * jadi tak ada kolom DB yang di-`ORDER BY` di sini.
     */
    public function up(): void
    {
        $pilihan = fn (string $kode, string $label) => [
            'kode' => explode(',', $kode),
            'label' => $label,
            'arah' => null,
            'bawaan' => false,
        ];

        $opsi = [
            $pilihan('nama', 'Nama'),
            $pilihan('kode', 'Kode'),
            $pilihan('urutan', 'Urutan'),
            $pilihan('sumber', 'Sumber'),
            $pilihan('tampil', 'Tampil'),
        ];

        $sekarang = now();
        DB::table('urut_preset')->updateOrInsert(
            ['table_key' => 'referensi'],
            ['opsi' => json_encode($opsi), 'created_at' => $sekarang, 'updated_at' => $sekarang],
        );
    }

    public function down(): void
    {
        DB::table('urut_preset')->where('table_key', 'referensi')->delete();
    }
};
