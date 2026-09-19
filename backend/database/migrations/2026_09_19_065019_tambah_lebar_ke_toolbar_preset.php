<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            // Lebar kontrol toolbar per kunci (px): peta kontrol → integer.
            // Absen = pakai bawaan frontend (cari 140, urut/kolom 176).
            $table->json('lebar')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->dropColumn('lebar');
        });
    }
};
