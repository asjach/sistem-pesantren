<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Opsi urut bawaan dropdown Urutkan tab Kelola Dispensasi (Daftar Santri).
     *
     * Kodenya HARUS ada di katalog `santri` (`UrutKatalog::PETA['santri']`)
     * karena endpoint `GET /api/admin/santri` memvalidasinya: kode di luar
     * allowlist ditolak 422.
     *
     * `kelas` & `jenjang` BOLEH ditawarkan meski keduanya bukan kolom `santri`:
     * keduanya dipilih dari banyak baris riwayat, dan pengurutannya ditangani
     * `SantriController::urutKelasJenjang` lewat subquery dengan aturan pilih
     * yang sama seperti yang menampilkan nilainya (semester 2 menang; jenjang
     * utama MI > MD > MTS; santri tanpa riwayat selalu di belakang).
     * `nis` tetap TIDAK ditawarkan: yang tampil = NIS lokal per lembaga, bisa
     * gabungan beberapa lembaga, jadi tak punya kunci urut tunggal.
     *
     * Tanpa opsi bawaan terpilih agar urutan awal tetap warisan endpoint
     * (jk → nama).
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
            $pilihan('nama', 'Nama Santri'),
            $pilihan('nisn', 'NISN'),
            $pilihan('jk', 'Jenis Kelamin'),
            $pilihan('kelas', 'Kelas'),
            $pilihan('jenjang', 'Jenjang'),
        ];

        $sekarang = now();
        DB::table('urut_preset')->updateOrInsert(
            ['table_key' => 'dispensasi_kandidat'],
            ['opsi' => json_encode($opsi), 'created_at' => $sekarang, 'updated_at' => $sekarang],
        );
    }

    public function down(): void
    {
        DB::table('urut_preset')->where('table_key', 'dispensasi_kandidat')->delete();
    }
};
