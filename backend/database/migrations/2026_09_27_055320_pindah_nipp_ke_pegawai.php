<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * NIPP pindah ke `pegawai` sebagai identitas unik global per orang
     * (jembatan migrasi dari sistem lama), bukan lagi per lembaga.
     */
    public function up(): void
    {
        Schema::table('pegawai', function (Blueprint $table) {
            $table->string('nipp', 30)->nullable()->after('nip');
            $table->unique('nipp');
        });

        Schema::table('lembaga_pegawai', function (Blueprint $table) {
            $table->dropUnique(['jenjang', 'nipp']);
            $table->dropColumn('nipp');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lembaga_pegawai', function (Blueprint $table) {
            $table->string('nipp', 30)->nullable();
            $table->unique(['jenjang', 'nipp']);
        });

        Schema::table('pegawai', function (Blueprint $table) {
            $table->dropUnique(['nipp']);
            $table->dropColumn('nipp');
        });
    }
};
