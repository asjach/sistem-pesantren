<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sifat tetap/sementara dihapus: semua paket selalu otomatis,
        // kuota_bulan menjadi satu-satunya pembatas ("sementara" terjadi
        // dengan sendirinya saat kuota habis).
        Schema::table('dispensasi', function (Blueprint $table): void {
            $table->dropColumn('sifat');
        });
    }

    public function down(): void
    {
        Schema::table('dispensasi', function (Blueprint $table): void {
            $table->enum('sifat', ['tetap', 'sementara'])->default('tetap')->after('tahun_ajaran');
        });
    }
};
