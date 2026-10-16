<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kamus nama mapel lintas jenjang (`ref_mapel`): banyak mapel bernama sama
 * antar lembaga (Matematika, Bahasa Indonesia, ...), sehingga mapel per
 * lembaga (`mata_pelajaran`) tinggal memilih dari kamus ini. Struktur
 * identik kamus bebas lain (baris milik satu lembaga, tanpa baris global).
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ref_mapel', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->string('nama');
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['jenjang', 'nama']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ref_mapel');
    }
};
