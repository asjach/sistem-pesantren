<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hari libur mingguan per lembaga: daftar nama hari yang TIDAK ada kegiatan
 * belajar (mis. `["jumat"]` atau `["sabtu","minggu"]`). Disimpan JSON agar
 * pola tiap lembaga bebas (0–6 hari), dibaca modul jadwal sebagai hari yang
 * disembunyikan dari matriks + dilarang diisi.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('lembaga', function (Blueprint $table) {
            $table->json('hari_libur')->nullable()->after('waktu_belajar'); // null/[] = masuk semua hari
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lembaga', function (Blueprint $table) {
            $table->dropColumn('hari_libur');
        });
    }
};
