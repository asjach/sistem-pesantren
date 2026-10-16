<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mapel (`mata_pelajaran`) menyimpan singkatan tampilan — mis. 'Mat.' untuk
 * Matematika. NULLABLE karena baris lama (dan jalur impor yang kolomnya belum
 * memuat `singkatan`) tidak mengisinya; kosong berarti "tak ada singkatan",
 * bukan error.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('mata_pelajaran', function (Blueprint $table) {
            $table->string('singkatan', 50)->nullable()->after('kode_mapel');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mata_pelajaran', function (Blueprint $table) {
            $table->dropColumn('singkatan');
        });
    }
};
