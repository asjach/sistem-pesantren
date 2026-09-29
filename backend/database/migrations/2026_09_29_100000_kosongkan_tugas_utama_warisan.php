<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Pembersihan data warisan: baris `tugas_utama` yang masih 'Guru Pengampu'
 * (nilai bawaan lama, TIDAK terdaftar di kamus `ref_tugas_utama`) dikosongkan
 * ke NULL — sesuai kebijakan tanpa default (2026_09_29_090000): tugas hanya
 * diisi eksplisit dari kamus. Tidak dipetakan ke nilai kamus karena 'Guru
 * Pengampu' ambigu (Guru Mapel / Guru Kelas / lainnya). Baris dengan nilai
 * lain (pilihan kamus sah) tidak disentuh.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('lembaga_pegawai')->where('tugas_utama', 'Guru Pengampu')->update(['tugas_utama' => null]);
        DB::table('keaktifan_pegawai')->where('tugas_utama', 'Guru Pengampu')->update(['tugas_utama' => null]);
    }

    public function down(): void
    {
        // Nilai asli tidak dapat direkonstruksi (tidak tercatat mana baris
        // yang terisi bawaan vs pilihan eksplisit pengguna) — no-op.
    }
};
