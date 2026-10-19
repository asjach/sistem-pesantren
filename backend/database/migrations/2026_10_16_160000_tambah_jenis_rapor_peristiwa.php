<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tandai peristiwa yang MENGHASILKAN RAPOR (klarifikasi pengguna 2026-10-16):
 * tidak semua peristiwa berbuah rapor — ASAS & ASAT menghasilkan rapor (akhir),
 * sedangkan UJIAN & UAP hanya nilai ujian/ijazah (bukan rapor). Nilai
 * `sementara` disediakan untuk rapor tengah semester (mis. PTS) bila nanti
 * dijadikan peristiwa; saat ini PTS masih komponen manual di dalam ASAS/ASAT.
 *
 * Lintas-DB: hanya `Schema::table` + update lewat query builder (tes memakai
 * SQLite in-memory).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('peristiwa_nilai', function (Blueprint $table) {
            $table->enum('jenis_rapor', ['akhir', 'sementara', 'tidak_ada'])
                ->default('tidak_ada')
                ->after('kurikulum');
        });

        DB::table('peristiwa_nilai')->whereIn('kode', ['ASAS', 'ASAT'])
            ->update(['jenis_rapor' => 'akhir']);
    }

    public function down(): void
    {
        Schema::table('peristiwa_nilai', function (Blueprint $table) {
            $table->dropColumn('jenis_rapor');
        });
    }
};
