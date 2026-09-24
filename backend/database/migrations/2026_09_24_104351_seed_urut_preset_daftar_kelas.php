<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Opsi urut bawaan dropdown Urutkan halaman Daftar Kelas (tanpa opsi
     * bawaan terpilih agar urutan awal tetap warisan: TA → semester →
     * kelas → absen → santri).
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
            $pilihan('santri', 'Santri'),
            $pilihan('kelas', 'Kelas'),
            $pilihan('tingkat', 'Tingkat'),
            $pilihan('absen', 'No. Absen'),
        ];

        $sekarang = now();
        DB::table('urut_preset')->updateOrInsert(
            ['table_key' => 'daftar_kelas'],
            ['opsi' => json_encode($opsi), 'created_at' => $sekarang, 'updated_at' => $sekarang],
        );
    }

    public function down(): void
    {
        DB::table('urut_preset')->where('table_key', 'daftar_kelas')->delete();
    }
};
