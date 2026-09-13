<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Preset kolom tabel (per lembaga, null = global admin pesantren) + pilihan terakhir per user. */
    public function up(): void
    {
        Schema::create('preset_tabel', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lembaga_id')->nullable()->constrained('lembaga')->cascadeOnDelete();
            $table->string('table_key', 60);
            $table->string('nama', 50);
            $table->json('kolom');
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['lembaga_id', 'table_key']);
        });

        Schema::create('preset_tabel_aktif', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('table_key', 60);
            $table->foreignId('preset_id')->nullable()->constrained('preset_tabel')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'table_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('preset_tabel_aktif');
        Schema::dropIfExists('preset_tabel');
    }
};
