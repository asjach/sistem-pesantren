<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Struktur kurikulum mengikuti VARIAN jadwal: satu sel JP dimiliki satu varian.
 *
 * Kolom `varian_jadwal_id` ditambahkan tanpa constraint FK eksplisit agar aman
 * di SQLite (ALTER TABLE ADD COLUMN + REFERENCES tidak didukung); relasinya
 * dijaga di aplikasi. Unik lama (jenjang, TA, tingkat, mapel) diganti unik
 * per (varian, tingkat, mapel).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('struktur_kurikulum', function (Blueprint $table) {
            $table->unsignedBigInteger('varian_jadwal_id')->nullable()->after('id');
        });

        Schema::table('struktur_kurikulum', function (Blueprint $table) {
            $table->dropUnique('struktur_kurikulum_sel_unique');
            $table->unique(
                ['varian_jadwal_id', 'tingkat', 'mata_pelajaran_id'],
                'struktur_kurikulum_varian_unique',
            );
            $table->index('varian_jadwal_id', 'struktur_kurikulum_varian_index');
        });
    }

    public function down(): void
    {
        Schema::table('struktur_kurikulum', function (Blueprint $table) {
            $table->dropUnique('struktur_kurikulum_varian_unique');
            $table->dropIndex('struktur_kurikulum_varian_index');
        });

        Schema::table('struktur_kurikulum', function (Blueprint $table) {
            $table->dropColumn('varian_jadwal_id');
        });

        Schema::table('struktur_kurikulum', function (Blueprint $table) {
            $table->unique(
                ['jenjang', 'tahun_ajaran', 'tingkat', 'mata_pelajaran_id'],
                'struktur_kurikulum_sel_unique',
            );
        });
    }
};
