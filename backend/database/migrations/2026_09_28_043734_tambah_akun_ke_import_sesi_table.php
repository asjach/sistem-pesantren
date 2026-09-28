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
        Schema::table('import_sesi', function (Blueprint $table) {
            $table->unsignedInteger('akun_dibuat')->default(0)->after('riwayat_dibuat');
            $table->unsignedInteger('akun_dilewati')->default(0)->after('akun_dibuat');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('import_sesi', function (Blueprint $table) {
            $table->dropColumn(['akun_dibuat', 'akun_dilewati']);
        });
    }
};
