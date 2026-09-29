<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cabut kolom `path_file` dari tiga tabel dokumen.
 *
 * Lokasi fisik kini dihitung (`direktori kanonis + nama_file` via
 * `NamaBerkasDokumen::jalur()`); nama tampil/unduh = `nama_file` (template).
 * Prasyarat sudah dipenuhi sebelum migrasi ini: semua penulis memakai
 * template dan perintah `dokumen:rapikan-nama` menyelaraskan baris lama.
 * Statement mentah agar tanpa doctrine/dbal (MySQL + SQLite).
 */
return new class extends Migration
{
    /** @var list<string> */
    private const TABEL = ['dokumen_santri', 'dokumen_pegawai', 'dokumen_lembaga'];

    public function up(): void
    {
        foreach (self::TABEL as $tabel) {
            if (Schema::hasColumn($tabel, 'path_file')) {
                DB::statement("ALTER TABLE {$tabel} DROP COLUMN path_file");
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABEL as $tabel) {
            if (! Schema::hasColumn($tabel, 'path_file')) {
                DB::statement("ALTER TABLE {$tabel} ADD COLUMN path_file VARCHAR(255) NULL");
            }
        }
    }
};
