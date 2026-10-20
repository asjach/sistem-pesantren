<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Struktur kurikulum: jumlah JP per minggu per mata pelajaran × tingkat,
 * untuk satu jenjang + tahun ajaran. Hanya REFERENSI — tidak mengunci
 * atau memvalidasi jadwal pelajaran.
 *
 * `struktur_kurikulum_pengaturan` menyimpan jumlah minggu efektif per
 * jenjang + tahun ajaran (dasar hitungan JP per tahun).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('struktur_kurikulum', function (Blueprint $table) {
            $table->id();
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
                ['jenjang', 'tahun_ajaran', 'tingkat', 'mata_pelajaran_id'],
                'struktur_kurikulum_sel_unique',
            );
            $table->index(['jenjang', 'tahun_ajaran'], 'struktur_kurikulum_lingkup_index');
        });

        Schema::create('struktur_kurikulum_pengaturan', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->unsignedSmallInteger('minggu_efektif')->default(36);
            $table->timestamps();

            $table->unique(['jenjang', 'tahun_ajaran'], 'struktur_kurikulum_pengaturan_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('struktur_kurikulum_pengaturan');
        Schema::dropIfExists('struktur_kurikulum');
    }
};
