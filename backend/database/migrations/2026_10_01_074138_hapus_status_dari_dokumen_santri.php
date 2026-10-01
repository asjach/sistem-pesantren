<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cabut kolom `status_verifikasi` dan `tidak_memiliki` dari `dokumen_santri`.
 *
 * Fitur verifikasi dokumen + tanda "tidak memiliki" dihapus total (backend,
 * import, dan PSB disesuaikan); tabel pegawai/lembaga tidak tersentuh.
 * Statement mentah agar tanpa doctrine/dbal (MySQL + SQLite).
 */
return new class extends Migration
{
    /** @var list<string> */
    private const KOLOM = ['status_verifikasi', 'tidak_memiliki'];

    public function up(): void
    {
        foreach (self::KOLOM as $kolom) {
            if (Schema::hasColumn('dokumen_santri', $kolom)) {
                DB::statement("ALTER TABLE dokumen_santri DROP COLUMN {$kolom}");
            }
        }
    }

    public function down(): void
    {
        // SQLite (DB tes) tak mendukung ENUM mentah — pakai builder.
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('dokumen_santri', function (Blueprint $table) {
                if (! Schema::hasColumn('dokumen_santri', 'status_verifikasi')) {
                    $table->string('status_verifikasi', 20)->default('menunggu');
                }
                if (! Schema::hasColumn('dokumen_santri', 'tidak_memiliki')) {
                    $table->boolean('tidak_memiliki')->default(false);
                }
            });

            return;
        }
        if (! Schema::hasColumn('dokumen_santri', 'status_verifikasi')) {
            DB::statement("ALTER TABLE dokumen_santri ADD COLUMN status_verifikasi ENUM('menunggu','valid','ditolak') NOT NULL DEFAULT 'menunggu'");
        }
        if (! Schema::hasColumn('dokumen_santri', 'tidak_memiliki')) {
            DB::statement('ALTER TABLE dokumen_santri ADD COLUMN tidak_memiliki TINYINT(1) NOT NULL DEFAULT 0');
        }
    }
};
