<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Selaraskan struktur `dokumen_pegawai` dengan `dokumen_santri`:
 * - tambah `lembaga` (konteks pemakaian, FK → lembaga.jenjang) + `is_active`;
 * - cabut `status_verifikasi` (status hanya tersisa di `dokumen_lembaga`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dokumen_pegawai', function (Blueprint $table) {
            $table->string('lembaga', 20)->nullable()->after('jenis_dokumen_pegawai');
            $table->foreign('lembaga')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->boolean('is_active')->default(true)->after('lembaga');
        });

        Schema::table('dokumen_pegawai', function (Blueprint $table) {
            $table->dropColumn('status_verifikasi');
        });
    }

    public function down(): void
    {
        Schema::table('dokumen_pegawai', function (Blueprint $table) {
            $table->dropForeign(['lembaga']);
            $table->dropColumn(['lembaga', 'is_active']);
        });

        Schema::table('dokumen_pegawai', function (Blueprint $table) {
            $table->enum('status_verifikasi', ['menunggu', 'valid', 'ditolak'])->default('menunggu');
        });
    }
};
