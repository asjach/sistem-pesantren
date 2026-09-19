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
            // Satu preset bawaan per tabel: dipakai bila user belum memilih
            // preset pribadi (eksklusivitas per table_key dijaga di service).
            $table->boolean('is_default')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('preset_tabel', function (Blueprint $table) {
            $table->dropColumn('is_default');
        });
    }
};
