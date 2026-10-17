<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Template jadwal generik (kerangka slot generik): pola susunan mapel per
 * jenjang (hari × urutan slot × mapel master) tanpa guru, siap diterapkan ke
 * kelas mana pun yang sejenjang. Saat diterapkan, tiap baris dipetakan ke slot
 * jam nyata (berdasar `urutan_slot`) dan ke pengampu kelas tujuan (berdasar
 * `mata_pelajaran_id`).
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('template_jadwal', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nama', 100);
            $table->text('deskripsi')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['jenjang', 'nama']);
        });

        Schema::create('template_jadwal_baris', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_jadwal_id')->constrained('template_jadwal')->cascadeOnDelete();
            $table->enum('hari', ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']);
            $table->integer('urutan_slot')->default(1); // posisi slot generik (1, 2, 3, ...)
            $table->foreignId('mata_pelajaran_id')->constrained('mata_pelajaran')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['template_jadwal_id', 'hari', 'urutan_slot'], 'uq_template_baris_hari_slot');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('template_jadwal_baris');
        Schema::dropIfExists('template_jadwal');
    }
};
