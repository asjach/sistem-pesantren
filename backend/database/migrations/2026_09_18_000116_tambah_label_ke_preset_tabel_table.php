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
        Schema::table('preset_tabel', function (Blueprint $table) {
            // Nama header kustom per kolom (key = key kolom grid); kosong = label bawaan.
            $table->json('label')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('preset_tabel', function (Blueprint $table) {
            $table->dropColumn('label');
        });
    }
};
