<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Standar tampilan GLOBAL yang disebar super_admin ke SEMUA pengguna.
 *
 * Bentuk key-value (satu baris per kunci setelan), bukan satu kolom per
 * setelan: menambah setelan global baru cukup menambah aturan validasi, tanpa
 * migrasi — pola sama `komponen_custom`.
 *
 * Cakupannya SENGAJA sempit. Hanya setelan yang bermakna sebagai standar
 * bersama yang boleh masuk; setelan yang bergantung perangkat (lebar sidebar,
 * mode navigasi) tetap milik perangkat karena mengikuti ukuran layar.
 *
 * Setelan di sini adalah LAPISAN BAWAH: pengguna tetap boleh menimpanya di
 * perangkatnya sendiri (lihat `GridPrefs` di frontend).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pengaturan_global', function (Blueprint $table) {
            $table->id();
            $table->string('kunci', 60)->unique();
            $table->json('nilai')->nullable();
            $table->foreignId('diubah_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pengaturan_global');
    }
};
