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
        Schema::table('dispensasi', function (Blueprint $table): void {
            // Tetap = otomatis tiap generate; sementara = hanya bila
            // dicentang di dialog generate (atau manual via Ubah).
            $table->enum('sifat', ['tetap', 'sementara'])->default('tetap')->after('tahun_ajaran');
        });
    }

    public function down(): void
    {
        Schema::table('dispensasi', function (Blueprint $table): void {
            $table->dropColumn('sifat');
        });
    }
};
