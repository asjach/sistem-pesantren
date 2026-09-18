<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Index FULLTEXT ngram untuk pencarian nama santri (substring).
 *
 * Hanya MySQL/MariaDB yang mendukung FULLTEXT + parser ngram; driver lain
 * (mis. SQLite untuk tes) dilewati dan pencarian jatuh ke LIKE biasa.
 */
return new class extends Migration
{
    private const INDEX = 'santri_nama_lengkap_fulltext';

    public function up(): void
    {
        if (! $this->mysql()) {
            return;
        }

        DB::statement('ALTER TABLE santri ADD FULLTEXT INDEX '.self::INDEX.' (nama_lengkap) WITH PARSER ngram');
    }

    public function down(): void
    {
        if (! $this->mysql()) {
            return;
        }

        DB::statement('ALTER TABLE santri DROP INDEX '.self::INDEX);
    }

    private function mysql(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true);
    }
};
