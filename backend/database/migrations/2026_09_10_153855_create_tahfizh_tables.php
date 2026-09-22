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
        Schema::create('target_tahfiz', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nama_target'); // 'Target Juz 30 Kelas 7'
            $table->integer('juz_awal');
            $table->integer('juz_akhir');
            $table->integer('target_halaman')->nullable();
            $table->timestamps();
        });

        Schema::create('setoran_tahfiz', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->foreignId('penguji_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('tanggal');
            $table->enum('jenis', ['ziyadah', 'muraaja_ah'])->default('ziyadah');
            $table->integer('juz'); // 1..30
            $table->integer('surah_awal_id'); // 1..114 (integer lookup, tanpa tabel)
            $table->integer('ayat_awal');
            $table->integer('surah_akhir_id');
            $table->integer('ayat_akhir');
            $table->integer('jumlah_halaman')->default(0);
            $table->string('nilai', 2)->nullable(); // 'A','B','C','D'
            $table->enum('kelancaran', ['lancar', 'kurang_lancar', 'mengulang'])->default('lancar');
            $table->text('catatan')->nullable();
            $table->timestamps();
        });

        Schema::create('rekap_tahfiz_santri', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->integer('total_juz_mutqin')->default(0);
            $table->integer('total_juz_ziyadah')->default(0);
            $table->integer('juz_terakhir')->nullable();
            $table->integer('surah_terakhir_id')->nullable();
            $table->integer('ayat_terakhir')->nullable();
            $table->timestamps();

            $table->unique(['santri_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rekap_tahfiz_santri');
        Schema::dropIfExists('setoran_tahfiz');
        Schema::dropIfExists('target_tahfiz');
    }
};
