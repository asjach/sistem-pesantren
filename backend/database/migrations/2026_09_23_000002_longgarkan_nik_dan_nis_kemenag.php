<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Longgarkan identitas & NIS Kemenag:
 *
 * - `santri.nik/no_kk/ayah_nik/ibu_nik/wali_nik`: VARCHAR(16) → VARCHAR(20)
 *   agar muat awalan penanda tak valid `X-` (mis. `X-320410460905001).
 * - Lepas unique `uq_lembaga_santri_nis_kemenag`: NIS Kemenag hasil generate,
 *   boleh digenerate ulang & boleh duplikat.
 *
 * SQLite (pengujian) bertipe dinamis: pelebaran kolom tak perlu; index unik
 * tetap harus dibuang eksplisit agar tes duplikat lolos.
 */
return new class extends Migration
{
    private bool $mysql;

    public function __construct()
    {
        $this->mysql = DB::getDriverName() === 'mysql';
    }

    public function up(): void
    {
        if ($this->mysql) {
            foreach (['nik', 'no_kk', 'ayah_nik', 'ibu_nik', 'wali_nik'] as $kolom) {
                DB::statement("ALTER TABLE santri MODIFY {$kolom} VARCHAR(20) NULL");
            }
            DB::statement('ALTER TABLE lembaga_santri DROP INDEX uq_lembaga_santri_nis_kemenag');

            return;
        }

        DB::statement('DROP INDEX IF EXISTS uq_lembaga_santri_nis_kemenag');
    }

    public function down(): void
    {
        if (! $this->mysql) {
            return;
        }

        foreach (['nik', 'no_kk', 'ayah_nik', 'ibu_nik', 'wali_nik'] as $kolom) {
            DB::statement("ALTER TABLE santri MODIFY {$kolom} VARCHAR(16) NULL");
        }
        DB::statement('ALTER TABLE lembaga_santri ADD UNIQUE uq_lembaga_santri_nis_kemenag (jenjang, nis_kemenag)');
    }
};
