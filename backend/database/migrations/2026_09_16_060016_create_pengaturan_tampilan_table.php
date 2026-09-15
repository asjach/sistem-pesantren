<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Standar tampilan per lembaga (tema/tipografi/grid/preset aktif), disebar super_admin. */
    public function up(): void
    {
        Schema::create('pengaturan_tampilan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lembaga_id')->unique()->constrained('lembaga')->cascadeOnDelete();
            $table->json('data');
            // Naik setiap perubahan agar klien bisa memantau & memuat ulang.
            $table->unsignedInteger('versi')->default(1);
            $table->foreignId('diubah_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pengaturan_tampilan');
    }
};
