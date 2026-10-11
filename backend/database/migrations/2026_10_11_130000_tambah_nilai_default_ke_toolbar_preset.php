<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nilai AWAL combobox per kontrol toolbar (GLOBAL): peta kunci kontrol →
     * label opsi (`urut`, `kolom`, atau `filter.<htmlFor>`). Dipilih dari
     * popover klik-kanan combobox; absen = pakai nilai dari pemanggil.
     */
    public function up(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->json('nilai_default')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->dropColumn('nilai_default');
        });
    }
};
