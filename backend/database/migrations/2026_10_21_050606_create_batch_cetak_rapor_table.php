<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batch_cetak_rapor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('peristiwa_id')->constrained('peristiwa_nilai')->cascadeOnDelete();
            $table->string('semester', 2);
            $table->foreignId('kelas_id')->constrained('kelas')->cascadeOnDelete();
            $table->string('wali_kelas')->nullable();
            $table->string('kepala')->nullable();
            $table->timestamps();

            $table->unique(['peristiwa_id', 'semester', 'kelas_id'], 'uq_batch_cetak_rapor');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_cetak_rapor');
    }
};
