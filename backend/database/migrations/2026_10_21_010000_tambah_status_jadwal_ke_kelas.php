<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Status jadwal per kelas: draft → pembahasan → final.
 *
 * Kelas berstatus `final` terkunci (jadwalnya tidak bisa diubah) sampai
 * dikembalikan ke `draft`. Status per lembaga + tahun ajaran DITURUNKAN:
 * final hanya bila SELURUH kelasnya final.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kelas', function (Blueprint $table) {
            $table->enum('status_jadwal', ['draft', 'pembahasan', 'final'])
                ->default('draft')
                ->after('nama_alias');
        });
    }

    public function down(): void
    {
        Schema::table('kelas', function (Blueprint $table) {
            $table->dropColumn('status_jadwal');
        });
    }
};
