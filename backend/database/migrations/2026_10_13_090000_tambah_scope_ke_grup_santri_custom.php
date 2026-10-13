<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Grup santri custom ikut lingkup lembaga + tahun ajaran (untuk filter di
 * halaman Santri Custom) dan punya status aktif/tidak aktif. Kolom polos
 * tanpa FK (skema grup masih berkembang).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('grup_santri_custom', function (Blueprint $table) {
            $table->string('jenjang', 50)->nullable()->after('keterangan');
            $table->string('tahun_ajaran', 20)->nullable()->after('jenjang');
            $table->boolean('is_active')->default(true)->after('tahun_ajaran');
        });
    }

    public function down(): void
    {
        Schema::table('grup_santri_custom', function (Blueprint $table) {
            $table->dropColumn(['jenjang', 'tahun_ajaran', 'is_active']);
        });
    }
};
