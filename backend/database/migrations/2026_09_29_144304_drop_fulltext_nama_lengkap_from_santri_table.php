<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cabut index FULLTEXT ngram `santri_nama_lengkap_fulltext`.
 *
 * Pencarian nama kini LIKE substring untuk semua driver (index-nya terbukti
 * tak mengembalikan baris di DB ini). Hanya MySQL/MariaDB yang disentuh;
 * driver lain (mis. SQLite untuk tes) dilewati seperti migrasi pembuatnya.
 */
return new class extends Migration
{
    private const INDEX = 'santri_nama_lengkap_fulltext';

    public function up(): void
    {
        if (! $this->mysql()) {
            return;
        }

        if ($this->indexAda()) {
            DB::statement('ALTER TABLE santri DROP INDEX '.self::INDEX);
        }
    }

    public function down(): void
    {
        if (! $this->mysql()) {
            return;
        }

        if (! $this->indexAda()) {
            DB::statement('ALTER TABLE santri ADD FULLTEXT INDEX '.self::INDEX.' (nama_lengkap) WITH PARSER ngram');
        }
    }

    private function mysql(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    private function indexAda(): bool
    {
        return Schema::hasIndex('santri', self::INDEX);
    }
};
