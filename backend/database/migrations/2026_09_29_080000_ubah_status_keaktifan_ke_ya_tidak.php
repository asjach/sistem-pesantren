<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Penyeragaman status boolean pegawai: `keaktifan_pegawai.status_keaktifan`
 * ENUM('aktif','inaktif') → ENUM('Ya','Tidak'), mengikuti konvensi kolom
 * status lain (`lembaga_pegawai.is_active_lembaga`, `santri.is_active_pst`).
 *
 * Tiga langkah agar aman di kedua driver:
 * 1. lebarkan ke VARCHAR (SQLite: lepas CHECK; MySQL: ENUM → VARCHAR);
 * 2. normalisasi data ('aktif' → 'Ya', 'inaktif' → 'Tidak');
 * 3. ketatkan ke ENUM('Ya','Tidak') default 'Ya'.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('keaktifan_pegawai', function (Blueprint $table) {
            $table->string('status_keaktifan', 10)->default('Ya')->change();
        });

        DB::table('keaktifan_pegawai')->where('status_keaktifan', 'inaktif')->update(['status_keaktifan' => 'Tidak']);
        DB::table('keaktifan_pegawai')->where('status_keaktifan', 'aktif')->update(['status_keaktifan' => 'Ya']);

        Schema::table('keaktifan_pegawai', function (Blueprint $table) {
            $table->enum('status_keaktifan', ['Ya', 'Tidak'])->default('Ya')->change();
        });
    }

    public function down(): void
    {
        Schema::table('keaktifan_pegawai', function (Blueprint $table) {
            $table->string('status_keaktifan', 10)->default('aktif')->change();
        });

        DB::table('keaktifan_pegawai')->where('status_keaktifan', 'Tidak')->update(['status_keaktifan' => 'inaktif']);
        DB::table('keaktifan_pegawai')->where('status_keaktifan', 'Ya')->update(['status_keaktifan' => 'aktif']);

        Schema::table('keaktifan_pegawai', function (Blueprint $table) {
            $table->enum('status_keaktifan', ['aktif', 'inaktif'])->default('aktif')->change();
        });
    }
};
