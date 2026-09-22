<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Semester aktif kembali per lembaga: baris global lama (tak bisa
     * dipetakan) dibuang, kolom lembaga dipasang lagi (unik, cascade).
     */
    public function up(): void
    {
        DB::table('semester_aktif')->delete();

        Schema::table('semester_aktif', function (Blueprint $table) {
            $table->string('jenjang', 20)->unique();
            $table->foreign('jenjang')->references('jenjang')->on('lembaga')->cascadeOnUpdate()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('semester_aktif', function (Blueprint $table) {
            $table->dropForeign(['jenjang']);
            $table->dropUnique(['jenjang']);
            $table->dropColumn('jenjang');
        });
    }
};
