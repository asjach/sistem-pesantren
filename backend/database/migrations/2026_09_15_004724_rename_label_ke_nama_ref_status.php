<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Seragamkan kolom tabel ref: `ref_status_awal` & `ref_status_akhir` memakai
     * `nama` (tampilan) seperti 34 tabel ref lain, sehingga pengurutan ref bisa
     * seragam: `urutan ASC, nama ASC` (RefService). Nilai yang disimpan konsumen
     * tetap `kode` — kolom ini tidak direferensikan FK apa pun.
     */
    public function up(): void
    {
        Schema::table('ref_status_awal', function (Blueprint $table) {
            $table->renameColumn('label', 'nama');
        });

        Schema::table('ref_status_akhir', function (Blueprint $table) {
            $table->renameColumn('label', 'nama');
        });
    }

    public function down(): void
    {
        Schema::table('ref_status_awal', function (Blueprint $table) {
            $table->renameColumn('nama', 'label');
        });

        Schema::table('ref_status_akhir', function (Blueprint $table) {
            $table->renameColumn('nama', 'label');
        });
    }
};
