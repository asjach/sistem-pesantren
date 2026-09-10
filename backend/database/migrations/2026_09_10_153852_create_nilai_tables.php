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
                Schema::create('nilai_santri', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
                    $table->foreignId('pengampu_mapel_id')->constrained('pengampu_mapel')->cascadeOnDelete();
                    $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->cascadeOnDelete();
                    $table->string('semester', 2); // '1' atau '2'

                    $table->decimal('nilai_formatif', 5, 2)->default(0);
                    $table->decimal('nilai_sumatif', 5, 2)->default(0);
                    $table->decimal('nilai_akhir', 5, 2)->default(0);
                    $table->string('predikat', 2)->nullable(); // A, B, C, D
                    $table->text('catatan_capaian')->nullable();

                    $table->timestamps();

                    $table->unique(['santri_id', 'pengampu_mapel_id', 'tahun_ajaran_id', 'semester'], 'unique_nilai_santri');
                });

                Schema::create('rapor_catatan_wali', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
                    $table->foreignId('kelas_id')->constrained('kelas')->cascadeOnDelete();
                    $table->foreignId('tahun_ajaran_id')->constrained('tahun_ajaran')->cascadeOnDelete();
                    $table->string('semester', 2);

                    $table->integer('sakit')->default(0);
                    $table->integer('izin')->default(0);
                    $table->integer('alpa')->default(0);

                    $table->text('catatan_akademik')->nullable();
                    $table->text('catatan_karakter')->nullable();
                    $table->string('keputusan_kenaikan')->nullable(); // 'Naik ke kelas X', 'Lulus', dsb.

                    $table->timestamps();

                    $table->unique(['santri_id', 'kelas_id', 'tahun_ajaran_id', 'semester'], 'unique_catatan_wali');
                });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rapor_catatan_wali');
        Schema::dropIfExists('nilai_santri');
    }
};
