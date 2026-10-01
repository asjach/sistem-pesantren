<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Satu santri boleh punya >1 berkas sejenis (mis. Pas Foto MI/MTs/MLN):
 * - `lembaga` (nullable): konteks pemakaian (foto MI dipakai di MI).
 * - `is_active`: penanda dokumen terakhir/aktif per (santri, jenis, lembaga).
 *
 * Kunci rangkap dijaga level aplikasi (impor/upload), bukan unique DB,
 * mengikuti pola dedup service yang sudah ada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dokumen_santri', function (Blueprint $table) {
            $table->string('lembaga', 20)->nullable()->after('jenis_dokumen_santri');
            $table->foreign('lembaga')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
            $table->boolean('is_active')->default(true)->after('lembaga');
        });
    }

    public function down(): void
    {
        Schema::table('dokumen_santri', function (Blueprint $table) {
            $table->dropForeign(['lembaga']);
            $table->dropColumn(['lembaga', 'is_active']);
        });
    }
};
