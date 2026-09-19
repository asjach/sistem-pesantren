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
            $table->foreignId('lembaga_id')->unique()->constrained('lembaga')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('semester_aktif', function (Blueprint $table) {
            $table->dropForeign(['lembaga_id']);
            $table->dropUnique(['lembaga_id']);
            $table->dropColumn('lembaga_id');
        });
    }
};
