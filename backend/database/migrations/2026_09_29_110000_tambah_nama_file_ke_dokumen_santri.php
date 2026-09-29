<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tambah `nama_file` ke `dokumen_santri` — nama asli berkas yang diunggah
 * pengguna (label tetap), sejajar `dokumen_pegawai.nama_file` (dulu
 * `pegawai_dokumen`). Dibutuhkan
 * karena `path_file` disimpan hasil `store()` yang meng-hash nama berkas.
 * Data eksisting tidak di-backfill: nama asli tidak dapat direkonstruksi
 * dari path ter-hash.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dokumen_santri', function (Blueprint $table) {
            $table->string('nama_file')->nullable()->after('path_file');
        });
    }

    public function down(): void
    {
        Schema::table('dokumen_santri', function (Blueprint $table) {
            $table->dropColumn('nama_file');
        });
    }
};
