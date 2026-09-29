<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Penyeragaman penamaan tabel dokumen: `pegawai_dokumen` → `dokumen_pegawai`,
 * sejajar `dokumen_santri` (dan kamus `ref_jenis_dokumen_pegawai`). Tabel ini
 * belum punya pemakai di kode (controller/model/route), jadi rename aman.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('pegawai_dokumen', 'dokumen_pegawai');
    }

    public function down(): void
    {
        Schema::rename('dokumen_pegawai', 'pegawai_dokumen');
    }
};
