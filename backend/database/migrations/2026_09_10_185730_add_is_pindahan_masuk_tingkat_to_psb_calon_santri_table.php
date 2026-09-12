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
        Schema::table('psb_calon_santri', function (Blueprint $table) {
            // Jenis PSB: false = santri baru, true = pindahan (root PRD: status_awal ACC).
            // Tingkat masuk disimpan per lembaga di psb_calon_lembaga.masuk_tingkat.
            $table->boolean('is_pindahan')->default(false)->after('is_lanjutan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('psb_calon_santri', function (Blueprint $table) {
            $table->dropColumn('is_pindahan');
        });
    }
};
