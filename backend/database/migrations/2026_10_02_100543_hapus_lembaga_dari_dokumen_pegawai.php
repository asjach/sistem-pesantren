<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cabut kolom `lembaga` dari `dokumen_pegawai`: konteks pemakaian per
 * lembaga hanya berlaku untuk santri; kunci rangkap pegawai cukup
 * (pegawai, jenis). FK ke lembaga.jenjang ikut dicabut.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dokumen_pegawai', function (Blueprint $table) {
            $table->dropForeign(['lembaga']);
            $table->dropColumn('lembaga');
        });
    }

    public function down(): void
    {
        Schema::table('dokumen_pegawai', function (Blueprint $table) {
            $table->string('lembaga', 20)->nullable()->after('jenis_dokumen_pegawai');
            $table->foreign('lembaga')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->nullOnDelete();
        });
    }
};
