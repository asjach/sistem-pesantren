<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `lembaga_santri.no_urut`: unsigned integer → string(20).
 *
 * Nomor urut boleh memuat sufiks huruf (mis. `706x`) untuk menandai data
 * ganda historis yang tak bisa diurut ulang (sudah tercatat di ijazah).
 * SQLite (pengujian) bertipe dinamis sehingga tak perlu diubah.
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
        if (! $this->mysql) {
            return;
        }

        DB::statement('ALTER TABLE lembaga_santri MODIFY no_urut VARCHAR(20) NULL');
    }

    public function down(): void
    {
        if (! $this->mysql) {
            return;
        }

        DB::statement('ALTER TABLE lembaga_santri MODIFY no_urut INT UNSIGNED NULL');
    }
};
