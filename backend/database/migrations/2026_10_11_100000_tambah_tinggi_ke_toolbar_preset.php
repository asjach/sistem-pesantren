<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tinggi kotak kontrol toolbar per tabel (GLOBAL): peta kunci kontrol →
     * px. Kuncinya SAMA dengan `lebar` (`urut`, `kolom`, `filter.<htmlFor>`)
     * sehingga satu kunci mengenali satu kontrol. Absen = ikut prop `tinggi`
     * bawaan komponen (26px).
     */
    public function up(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->json('tinggi')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->dropColumn('tinggi');
        });
    }
};
