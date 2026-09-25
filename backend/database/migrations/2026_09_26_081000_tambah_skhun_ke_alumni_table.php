<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Tabel kelulusan (alumni): tambah nomor SKHUN (Surat Keterangan Hasil Ujian Nasional). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('alumni', function (Blueprint $table) {
            $table->string('skhun')->nullable()->after('no_peserta');
        });
    }

    public function down(): void
    {
        Schema::table('alumni', function (Blueprint $table) {
            $table->dropColumn('skhun');
        });
    }
};
