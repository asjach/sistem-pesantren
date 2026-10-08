<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispensasi', function (Blueprint $table): void {
            // Kuota bulan (tagihan bulanan per santri yang boleh memuat
            // paket ini); null = tanpa batas.
            $table->unsignedInteger('kuota_bulan')->nullable()->after('sifat');
        });
    }

    public function down(): void
    {
        Schema::table('dispensasi', function (Blueprint $table): void {
            $table->dropColumn('kuota_bulan');
        });
    }
};
