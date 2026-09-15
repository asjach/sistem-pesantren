<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Koreksi skema: NIS maksimum 20 karakter (sebelumnya validasi aplikasi
     * memakai 10, padahal kolomnya `string` = varchar(255) tanpa batas nyata).
     */
    public function up(): void
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->string('nis', 20)->nullable()->change();
        });

        Schema::table('riwayat_belajar', function (Blueprint $table) {
            $table->string('nis', 20)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('riwayat_belajar', function (Blueprint $table) {
            $table->string('nis')->nullable()->change();
        });

        Schema::table('santri', function (Blueprint $table) {
            $table->string('nis')->nullable()->change();
        });
    }
};
