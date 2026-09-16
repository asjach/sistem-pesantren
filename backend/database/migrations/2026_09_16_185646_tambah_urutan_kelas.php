<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Urutan tampil kelas per lingkup (lembaga + tahun ajaran): menentukan urutan
 * daftar kelas, bukan abjad. Default 0 = belum diatur.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kelas', function (Blueprint $table) {
            $table->integer('urutan')->default(0)->after('tingkat');
            $table->index(['lembaga_id', 'tahun_ajaran_id', 'urutan'], 'kelas_lingkup_urutan_index');
        });
    }

    public function down(): void
    {
        Schema::table('kelas', function (Blueprint $table) {
            $table->dropIndex('kelas_lingkup_urutan_index');
            $table->dropColumn('urutan');
        });
    }
};
