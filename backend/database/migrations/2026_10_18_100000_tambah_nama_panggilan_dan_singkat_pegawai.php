<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Nama panggilan & singkat guru untuk tampilan padat (mis. jadwal). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pegawai', function (Blueprint $table) {
            $table->string('nama_panggilan', 100)->nullable()->after('nama_lengkap');
            $table->string('nama_singkat', 50)->nullable()->after('nama_panggilan');
        });
    }

    public function down(): void
    {
        Schema::table('pegawai', function (Blueprint $table) {
            $table->dropColumn(['nama_panggilan', 'nama_singkat']);
        });
    }
};
