<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kontrol urut pindah ke Preset Urut (global per tabel), jadi kolom
     * `bisa_urut` & `arah_bawaan` di kamus label tidak dipakai lagi.
     */
    public function up(): void
    {
        Schema::table('label_kolom', function (Blueprint $table) {
            $table->dropColumn(['bisa_urut', 'arah_bawaan']);
        });
    }

    public function down(): void
    {
        Schema::table('label_kolom', function (Blueprint $table) {
            $table->boolean('bisa_urut')->default(true);
            $table->enum('arah_bawaan', ['naik', 'turun'])->nullable();
        });
    }
};
