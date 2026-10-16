<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Modul Kurikulum & Mapel (BLOK 5) — dua kolom pelengkap.
 *
 *  Tabel intinya (`kurikulum`, `mata_pelajaran`, `kelas_kurikulum`,
 *  `kurikulum_mapel`, `pengampu_mapel`, `slot_jam_pelajaran`,
 *  `jadwal_pelajaran`) sudah dibuat sejak migrasi `2026_09_10_153851`; yang
 *  kurang untuk dipakai sehari-hari:
 *  - `mata_pelajaran.is_active` — nonaktifkan mapel tanpa menghapus (mapel lama
 *    masih dipakai baris nilai/pengampu);
 *  - `slot_jam_pelajaran.urutan` — urutan tampil jam pelajaran (jam_mulai boleh
 *    kosong, jadi tak bisa diandalkan untuk mengurutkan).
 *
 *  Lintas-DB (tes memakai SQLite in-memory): hanya `Schema::table` + ADD COLUMN
 *  dengan default, aman di kedua driver.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mata_pelajaran', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('kode_mapel');
        });

        Schema::table('slot_jam_pelajaran', function (Blueprint $table) {
            $table->integer('urutan')->default(0)->after('nama_slot');
        });
    }

    public function down(): void
    {
        Schema::table('slot_jam_pelajaran', function (Blueprint $table) {
            $table->dropColumn('urutan');
        });

        Schema::table('mata_pelajaran', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
