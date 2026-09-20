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
            // Urutan kolom data per table_key (array key kolom, global).
            // Absen = urutan bawaan frontend (urutan fields halaman).
            $table->json('urutan')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->dropColumn('urutan');
        });
    }
};
