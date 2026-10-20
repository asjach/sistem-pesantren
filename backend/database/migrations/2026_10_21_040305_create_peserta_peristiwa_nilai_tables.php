<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pengaturan_nomor_peserta', function (Blueprint $table) {
            $table->id();
            $table->foreignId('peristiwa_id')->constrained('peristiwa_nilai')->cascadeOnDelete();
            $table->string('semester', 2);
            $table->string('template', 200);
            $table->enum('mode_urutan', ['per_tingkat', 'semua_tingkat'])->default('per_tingkat');
            $table->timestamps();

            $table->unique(['peristiwa_id', 'semester'], 'uq_atur_nomor_peristiwa_semester');
        });

        Schema::create('peserta_peristiwa_nilai', function (Blueprint $table) {
            $table->id();
            $table->foreignId('peristiwa_id')->constrained('peristiwa_nilai')->cascadeOnDelete();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->string('semester', 2);
            $table->string('nomor_peserta', 100)->nullable();
            $table->enum('sumber_nomor', ['manual', 'otomatis'])->nullable();
            $table->timestamps();

            $table->unique(['peristiwa_id', 'semester', 'santri_id'], 'uq_peserta_peristiwa_semester');
            $table->unique(['peristiwa_id', 'semester', 'nomor_peserta'], 'uq_nomor_peristiwa_semester');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('peserta_peristiwa_nilai');
        Schema::dropIfExists('pengaturan_nomor_peserta');
    }
};
