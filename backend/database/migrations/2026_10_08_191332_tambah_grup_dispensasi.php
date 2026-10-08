<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispensasi', function (Blueprint $table): void {
            // Grup eksklusivitas: paket se-grup tak menumpuk dalam satu
            // tagihan (maks 1; mis. "prestasi"). Null = selalu digabung.
            $table->string('grup', 50)->nullable()->after('kuota_bulan');
        });
    }

    public function down(): void
    {
        Schema::table('dispensasi', function (Blueprint $table): void {
            $table->dropColumn('grup');
        });
    }
};
