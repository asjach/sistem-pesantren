<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pelacak sinkron cermin dua arah (lokal ↔ server): hash isi terakhir yang
 * diketahui sama di kedua sisi + waktu penyamaan. Null = belum pernah sinkron.
 */
return new class extends Migration
{
    /** @var list<string> */
    private const TABEL = ['dokumen_santri', 'dokumen_pegawai', 'dokumen_lembaga'];

    public function up(): void
    {
        foreach (self::TABEL as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->string('sinkron_hash', 64)->nullable()->after('nama_file');
                $table->timestamp('tersinkron_pada')->nullable()->after('sinkron_hash');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABEL as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->dropColumn(['sinkron_hash', 'tersinkron_pada']);
            });
        }
    }
};
