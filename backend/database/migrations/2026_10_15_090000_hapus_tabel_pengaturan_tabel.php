<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fitur filter topBar yang bisa diatur dari DB dihapus.
 *
 * Alasan: fitur ini tidak pernah dipakai — kelima baris yang ada berisi
 * `filter` kosong (`[]`) dan `filter_mode` yang sama dengan bawaan kode,
 * jadi tak satu pun mengubah perilaku. Halaman tanpa tabel juga nol baris.
 *
 * Visibilitas filter kini MURNI dari kode: `KONFIGURASI_FILTER_HALAMAN` +
 * `tampilEfektifFilterHalaman` di `src/lib/filterHalaman.ts`, dengan
 * `<PengaturanHalaman tampil={...}>` sebagai override per halaman.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('pengaturan_tabel');
    }

    public function down(): void
    {
        Schema::create('pengaturan_tabel', function (Blueprint $table) {
            $table->id();
            $table->string('table_key', 60)->unique();
            $table->json('filter');
            $table->json('filter_mode')->nullable();
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }
};
