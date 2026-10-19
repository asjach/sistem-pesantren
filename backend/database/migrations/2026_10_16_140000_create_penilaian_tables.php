<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Modul Penilaian — master + transaksi nilai.
 *
 *  Dua jalur input (lihat PRD "Rencana Modul Penilaian"):
 *  (A) HITUNG: `komponen_nilai` (+ bobot per TA) → `nilai_komponen` →
 *      `nilai_santri.nilai_akhir` (sumber='hitung').
 *  (B) IMPOR langsung: leger wide → `nilai_santri.nilai_akhir`
 *      (sumber='impor'); komponen boleh kosong.
 *
 *  KKM berjangkar pada peristiwa: satu baris `kkm_kegiatan` per komponen +
 *  satu baris khusus `AKHIR` (komponen_nilai_id null) per (jenjang, TA).
 *  Predikat diturunkan dari offset terhadap KKM `AKHIR` (`rentang_predikat`).
 *
 *  Tabel `nilai_santri` (formatif/sumatif/akhir) sudah ada sejak awal; modul
 *  ini hanya menambah kolom `sumber` sebagai penanda jalur pengisian.
 */
return new class extends Migration
{
    public function up(): void
    {

        Schema::table('nilai_santri', function (Blueprint $table) {
            $table->string('sumber', 10)->default('hitung')->after('nilai_akhir');
        });

        Schema::create('komponen_nilai', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('nama');
            $table->string('kode', 20)->nullable();
            $table->integer('urutan')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['jenjang', 'nama']);
        });

        Schema::create('komponen_nilai_bobot', function (Blueprint $table) {
            $table->id();
            $table->foreignId('komponen_nilai_id')->constrained('komponen_nilai')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->decimal('bobot', 5, 2)->default(0);
            $table->timestamps();

            $table->unique(['komponen_nilai_id', 'tahun_ajaran'], 'uq_komponen_bobot');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('kkm_kegiatan', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->foreignId('komponen_nilai_id')->nullable()->constrained('komponen_nilai')->cascadeOnDelete();

            $table->string('kegiatan', 50);
            $table->decimal('kkm', 5, 2)->default(0);
            $table->timestamps();

            $table->unique(['jenjang', 'tahun_ajaran', 'kegiatan'], 'uq_kkm_kegiatan');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('rentang_predikat', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->string('predikat', 2);
            $table->decimal('offset_bawah', 5, 2)->nullable();
            $table->string('keterangan')->nullable();
            $table->timestamps();

            $table->unique(['jenjang', 'tahun_ajaran', 'predikat'], 'uq_rentang_predikat');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('nilai_komponen', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->foreignId('pengampu_mapel_id')->constrained('pengampu_mapel')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->string('semester', 2);
            $table->foreignId('komponen_nilai_id')->constrained('komponen_nilai')->cascadeOnDelete();
            $table->decimal('skor', 5, 2)->nullable();
            $table->timestamps();

            $table->unique([
                'santri_id', 'pengampu_mapel_id', 'tahun_ajaran', 'semester', 'komponen_nilai_id',
            ], 'uq_nilai_komponen');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('ekstrakurikuler', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20);
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->string('nama');
            $table->string('pembimbing')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['jenjang', 'tahun_ajaran', 'nama'], 'uq_ekstrakurikuler');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('nilai_ekstrakurikuler', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->string('semester', 2);
            $table->foreignId('ekstrakurikuler_id')->constrained('ekstrakurikuler')->cascadeOnDelete();
            $table->string('predikat', 2)->nullable();
            $table->text('deskripsi')->nullable();

            $table->decimal('nilai', 5, 2)->nullable();
            $table->timestamps();

            $table->unique([
                'santri_id', 'tahun_ajaran', 'semester', 'ekstrakurikuler_id',
            ], 'uq_nilai_ekskul');
            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('prestasi_santri', function (Blueprint $table) {
            $table->id();
            $table->foreignId('santri_id')->constrained('santri')->cascadeOnDelete();
            $table->string('tahun_ajaran', 9);
            $table->string('semester', 2)->nullable();
            $table->string('prestasi');
            $table->string('level')->nullable();
            $table->text('keterangan')->nullable();
            $table->timestamps();

            $table->foreign('tahun_ajaran')->references('nama')->on('tahun_ajaran')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('predikat_ekskul', function (Blueprint $table) {
            $table->id();
            $table->string('jenjang', 20)->nullable();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('predikat', 2);
            $table->string('deskripsi');
            $table->integer('urutan')->default(0);
            $table->timestamps();

            $table->unique(['jenjang', 'predikat'], 'uq_predikat_ekskul');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('predikat_ekskul');
        Schema::dropIfExists('prestasi_santri');
        Schema::dropIfExists('nilai_ekstrakurikuler');
        Schema::dropIfExists('ekstrakurikuler');
        Schema::dropIfExists('nilai_komponen');
        Schema::dropIfExists('rentang_predikat');
        Schema::dropIfExists('kkm_kegiatan');
        Schema::dropIfExists('komponen_nilai_bobot');
        Schema::dropIfExists('komponen_nilai');

        Schema::table('nilai_santri', function (Blueprint $table) {
            $table->dropColumn('sumber');
        });
    }
};
