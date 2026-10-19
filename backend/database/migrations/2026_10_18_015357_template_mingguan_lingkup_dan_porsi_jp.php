<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Template jadwal menjadi pola MINGGUAN: tiap baris punya `hari` (null =
 * semua hari aktif). Template juga bisa berlingkup jenjang, tingkat, atau
 * kelas. Porsi JP per mapel untuk generator disimpan di pengampu kelas.
 */
return new class extends Migration
{
    private const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('template_jadwal', function (Blueprint $table) {
            $table->string('tingkat', 20)->nullable()->after('jenjang');
            $table->foreignId('kelas_id')->nullable()->after('tingkat')
                ->constrained('kelas')->nullOnDelete();
        });

        Schema::table('template_jadwal', function (Blueprint $table) {
            $table->index(['jenjang', 'tingkat', 'kelas_id'], 'idx_template_scope');
        });
        Schema::table('template_jadwal', function (Blueprint $table) {
            $table->dropUnique('template_jadwal_jenjang_nama_unique');
        });

        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->enum('hari', self::HARI)->nullable()->after('template_jadwal_id');
        });
        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->index(['template_jadwal_id', 'hari', 'urutan_slot'], 'idx_template_baris_hari');
        });
        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->dropUnique('uq_template_baris_urutan');
        });

        Schema::table('pengampu_mapel', function (Blueprint $table) {
            $table->unsignedTinyInteger('jp_per_minggu')->nullable()->after('mata_pelajaran_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pengampu_mapel', function (Blueprint $table) {
            $table->dropColumn('jp_per_minggu');
        });

        Schema::table('template_jadwal_baris', function (Blueprint $table) {

            $table->unique(['template_jadwal_id', 'urutan_slot'], 'uq_template_baris_urutan');
        });
        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->dropIndex('idx_template_baris_hari');
            $table->dropColumn('hari');
        });

        Schema::table('template_jadwal', function (Blueprint $table) {
            $table->unique(['jenjang', 'nama']);
        });
        Schema::table('template_jadwal', function (Blueprint $table) {
            $table->dropIndex('idx_template_scope');
            $table->dropConstrainedForeignId('kelas_id');
            $table->dropColumn('tingkat');
        });
    }
};
