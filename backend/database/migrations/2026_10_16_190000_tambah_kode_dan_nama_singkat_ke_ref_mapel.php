<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kamus mapel (`ref_mapel`) menyimpan kode & nama singkat.
 *
 * Kamus bebas lain hanya butuh `nama`, sedangkan mapel lazim punya kode
 * (mis. 'MTK') dan singkatan tampilan (mis. 'Mat.'). Keduanya NULLABLE karena
 * jalur kamus generik (`ReferensiController@store`, `RefService::sebar`,
 * `RefService::benihUntuk`) meng-insert hanya `jenjang/nama/urutan/is_active` —
 * kolom NOT NULL tanpa default akan menggagalkan insert tersebut.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('ref_mapel', function (Blueprint $table) {
            $table->string('kode', 20)->nullable()->after('nama');
            $table->string('nama_singkat', 50)->nullable()->after('kode');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ref_mapel', function (Blueprint $table) {
            $table->dropColumn(['kode', 'nama_singkat']);
        });
    }
};
