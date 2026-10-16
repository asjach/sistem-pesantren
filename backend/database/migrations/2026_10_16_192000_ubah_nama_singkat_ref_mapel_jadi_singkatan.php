<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Seragamkan istilah singkatan tampilan: `ref_mapel.nama_singkat` → `singkatan`.
 *
 * Kolom ini ditambahkan `2026_10_16_190000` dengan nama `nama_singkat`, tapi
 * istilah `singkatan` sudah dipakai di `mata_pelajaran.singkatan` — satu kolom
 * jangan punya dua nama. RENAME (bukan drop + add) supaya nilai singkatan yang
 * sudah diisi lewat kamus mapel tidak hilang, dan `down()` bisa mengembalikannya
 * persis seperti semula.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('ref_mapel', function (Blueprint $table) {
            $table->renameColumn('nama_singkat', 'singkatan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ref_mapel', function (Blueprint $table) {
            $table->renameColumn('singkatan', 'nama_singkat');
        });
    }
};
