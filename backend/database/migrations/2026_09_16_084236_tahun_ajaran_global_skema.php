<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tahun ajaran jadi data pesantren (global, mirip ref_*):
 * - `lembaga_id` NULL = TA global (dibuat super_admin, berlaku semua lembaga).
 * - `lembaga_id` terisi = baris bayangan lembaga (hanya untuk menyembunyikan).
 * - `is_aktif` = TA berjalan (satu, global). `is_active` = tampil/tidak (shadow).
 *
 * `psb_kegiatan` kehilangan penaut lembaganya (dulu via tahun_ajaran.lembaga_id),
 * jadi kolom `lembaga_id` ditambahkan di sini.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->foreignId('lembaga_id')->nullable()->after('id')->constrained('lembaga')->cascadeOnDelete();
        });

        // FK tahun_ajaran_id memakai index unique-nya, jadi urutan lepas harus:
        // drop FK → drop unique lama → pasang index biasa → pasang FK lagi.
        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropForeign(['tahun_ajaran_id']);
        });

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropUnique('psb_kegiatan_tahun_ajaran_id_nama_unique');
            $table->dropUnique('psb_kegiatan_tahun_ajaran_id_unique');
        });

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->index('tahun_ajaran_id');
            $table->foreign('tahun_ajaran_id')->references('id')->on('tahun_ajaran')->cascadeOnDelete();
        });

        Schema::table('tahun_ajaran', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('is_aktif');
        });

        Schema::table('tahun_ajaran', function (Blueprint $table) {
            $table->unsignedBigInteger('lembaga_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('tahun_ajaran', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropForeign(['tahun_ajaran_id']);
            $table->dropIndex(['tahun_ajaran_id']);
        });

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->unique(['tahun_ajaran_id', 'nama']);
            $table->unique('tahun_ajaran_id');
            $table->foreign('tahun_ajaran_id')->references('id')->on('tahun_ajaran')->cascadeOnDelete();
        });

        Schema::table('psb_kegiatan', function (Blueprint $table) {
            $table->dropConstrainedForeignId('lembaga_id');
        });
    }
};
