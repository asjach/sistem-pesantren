<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Opsi urut bawaan tab Tagihan (Keuangan, crosstab) — menyalin 4 opsi
     * dropdown lama (Select hardcode sebelum v2.373). Opsi "Nama" berisi dua
     * kode (kelas lalu nama, urutan bawaan halaman yang lama) dan ditandai
     * bawaan agar tampil terpilih saat halaman dibuka. Tanpa seed ini kontrol
     * "Urutkan" tak muncul (PresetUrut menyembunyikan diri saat opsi kosong).
     */
    public function up(): void
    {
        if (DB::table('urut_preset')->where('table_key', 'keuangan_tagihan_crosstab')->exists()) {
            return;
        }

        $pilihan = fn (string $kode, string $label, bool $bawaan = false) => [
            'kode' => explode(',', $kode),
            'label' => $label,
            'arah' => null,
            'bawaan' => $bawaan,
        ];

        $opsi = [
            $pilihan('kelas,nama', 'Nama', true),
            $pilihan('total', 'Total tagihan'),
            $pilihan('bayar', 'Terbayar'),
            $pilihan('sisa', 'Tunggakan'),
        ];

        $sekarang = now();
        DB::table('urut_preset')->insert([
            'table_key' => 'keuangan_tagihan_crosstab',
            'opsi' => json_encode($opsi),
            'created_at' => $sekarang,
            'updated_at' => $sekarang,
        ]);
    }

    public function down(): void
    {
        DB::table('urut_preset')->where('table_key', 'keuangan_tagihan_crosstab')->delete();
    }
};
