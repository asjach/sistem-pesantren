<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Struktur kurikulum kini DIHITUNG dari snapshot varian jadwal (jumlah JP per
 * mapel × tingkat), jadi tabel simpanan sel JP tidak dipakai lagi.
 * `struktur_kurikulum_pengaturan` (minggu efektif) tetap dipertahankan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('struktur_kurikulum');
    }

    public function down(): void
    {
        Schema::create('struktur_kurikulum', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('varian_jadwal_id')->nullable();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tingkat', 20);
            $table->foreignId('mata_pelajaran_id')->constrained('mata_pelajaran')->cascadeOnDelete();
            $table->unsignedSmallInteger('jp_per_minggu')->default(0);
            $table->timestamps();

            $table->unique(
                ['varian_jadwal_id', 'tingkat', 'mata_pelajaran_id'],
                'struktur_kurikulum_varian_unique',
            );
            $table->index('varian_jadwal_id', 'struktur_kurikulum_varian_index');
            $table->index(['jenjang', 'tahun_ajaran'], 'struktur_kurikulum_lingkup_index');
        });
    }
};
