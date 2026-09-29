<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hapus nilai bawaan `tugas_utama` (kolom jadi nullable tanpa default):
 * tugas wajib diisi eksplisit dari kamus `ref_tugas_utama`, tidak lagi
 * terisi otomatis 'Guru Pengampu' (nilai yang tak terdaftar di kamus).
 * Data eksisting tidak diubah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lembaga_pegawai', function (Blueprint $table) {
            $table->string('tugas_utama')->nullable()->change();
        });
        Schema::table('keaktifan_pegawai', function (Blueprint $table) {
            $table->string('tugas_utama')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('lembaga_pegawai', function (Blueprint $table) {
            $table->string('tugas_utama')->default('Guru Pengampu')->change();
        });
        Schema::table('keaktifan_pegawai', function (Blueprint $table) {
            $table->string('tugas_utama')->default('Guru Pengampu')->change();
        });
    }
};
