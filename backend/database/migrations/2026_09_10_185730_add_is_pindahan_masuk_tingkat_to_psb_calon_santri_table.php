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
            $table->boolean('is_pindahan')->default(false)->after('is_lanjutan');
            // Tingkat masuk: baru = entry jenjang (MI/MD 1, MTS 7, MLN 10);
            // pindahan = pilihan (MI/MD 2-6, MTS 8-9, MLN 11-12). Validasi di PsbService.
            $table->string('masuk_tingkat', 2)->nullable()->after('is_pindahan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('psb_calon_santri', function (Blueprint $table) {
            $table->dropColumn(['is_pindahan', 'masuk_tingkat']);
        });
    }
};
