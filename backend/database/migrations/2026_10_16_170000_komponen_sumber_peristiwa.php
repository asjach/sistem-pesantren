<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Komponen bisa bersumber dari PERISTIWA LAIN (mis. komponen "PTS" di dalam
 * ASAS/ASAT mengambil nilai akhir peristiwa PTS per mapel) — guru mengisi PTS
 * sekali saja.
 *
 *  `komponen_nilai.sumber` diperluas jadi manual | rapor_otomatis | peristiwa;
 *  `peristiwa_sumber_id` menunjuk peristiwa asal (hanya bermakna bila
 *  `sumber='peristiwa'`). Rujukan bersifat SATU TINGKAT (nilai akhir peristiwa
 *  asal dibaca apa adanya, tidak dihitung ulang) sehingga tak ada rekursi.
 *
 *  Lintas-DB: `change()` dipakai untuk memperluas enum — divalidasi pada SQLite
 *  sekali-pakai sebelum dirilis (tes memakai SQLite in-memory).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->foreignId('peristiwa_sumber_id')->nullable()->after('jumlah_tingkat_rapor')
                ->constrained('peristiwa_nilai')->nullOnDelete();
        });

        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->enum('sumber', ['manual', 'rapor_otomatis', 'peristiwa'])
                ->default('manual')
                ->change();
        });
    }

    public function down(): void
    {

        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->enum('sumber', ['manual', 'rapor_otomatis'])->default('manual')->change();
        });

        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->dropForeign(['peristiwa_sumber_id']);
            $table->dropColumn('peristiwa_sumber_id');
        });
    }
};
