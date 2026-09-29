<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * SK tiga level (nomor + tanggal, dokumen di `dokumen_pegawai` terpisah —
     * - pegawai: no_sk_awal + tgl_sk_awal (global)
     * - lembaga_pegawai: no_sk_awal_ptk + tgl_sk_awal_ptk (per jenjang)
     * - keaktifan_pegawai: no_sk + tgl_sk (tahunan; satu fisik SK multi-lembaga
     *   ditulis dengan nomor yang sama di tiap baris).
     */
    public function up(): void
    {
        Schema::table('pegawai', function (Blueprint $table) {
            $table->string('no_sk_awal', 100)->nullable()->after('tgl_mulai_kerja');
            $table->date('tgl_sk_awal')->nullable()->after('no_sk_awal');
        });

        Schema::table('lembaga_pegawai', function (Blueprint $table) {
            $table->string('no_sk_awal_ptk', 100)->nullable()->after('tahaj_masuk');
            $table->date('tgl_sk_awal_ptk')->nullable()->after('no_sk_awal_ptk');
        });

        Schema::table('keaktifan_pegawai', function (Blueprint $table) {
            $table->string('no_sk', 100)->nullable()->after('tugas_utama');
            $table->date('tgl_sk')->nullable()->after('no_sk');
            $table->index(['tahun_ajaran', 'jenjang'], 'idx_keaktifan_ta_jenjang_sk');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('keaktifan_pegawai', function (Blueprint $table) {
            $table->dropIndex('idx_keaktifan_ta_jenjang_sk');
            $table->dropColumn(['no_sk', 'tgl_sk']);
        });

        Schema::table('lembaga_pegawai', function (Blueprint $table) {
            $table->dropColumn(['no_sk_awal_ptk', 'tgl_sk_awal_ptk']);
        });

        Schema::table('pegawai', function (Blueprint $table) {
            $table->dropColumn(['no_sk_awal', 'tgl_sk_awal']);
        });
    }
};
