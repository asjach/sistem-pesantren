<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Rename nilai enum sumber komponen 'peristiwa' → 'kegiatan_evaluatif' tanpa kehilangan data. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->enum('sumber', ['manual', 'rapor_otomatis', 'peristiwa', 'kegiatan_evaluatif'])
                ->default('manual')->change();
        });

        DB::table('komponen_nilai')->where('sumber', 'peristiwa')->update(['sumber' => 'kegiatan_evaluatif']);

        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->enum('sumber', ['manual', 'rapor_otomatis', 'kegiatan_evaluatif'])
                ->default('manual')->change();
        });
    }

    public function down(): void
    {
        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->enum('sumber', ['manual', 'rapor_otomatis', 'peristiwa', 'kegiatan_evaluatif'])
                ->default('manual')->change();
        });

        DB::table('komponen_nilai')->where('sumber', 'kegiatan_evaluatif')->update(['sumber' => 'peristiwa']);

        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->enum('sumber', ['manual', 'rapor_otomatis', 'peristiwa'])
                ->default('manual')->change();
        });
    }
};
