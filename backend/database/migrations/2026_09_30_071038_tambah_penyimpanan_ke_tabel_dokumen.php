<?php

use App\Support\NamaBerkasDokumen;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /** Lokasi byte saat baris dibuat: server | lokal | test (arsip perangkat). */
    public function up(): void
    {
        foreach (['dokumen_santri', 'dokumen_pegawai', 'dokumen_lembaga'] as $tabel) {
            Schema::table($tabel, function (Blueprint $table): void {
                $table->string('penyimpanan', 10)->default('server')->after('nama_file');
            });
        }

        // Backfill: ada fisik di server → server; sisanya lokal (test tak bisa dibedakan retrospektif).
        $disk = Storage::disk('local');
        foreach (['santri' => 'dokumen_santri', 'pegawai' => 'dokumen_pegawai', 'lembaga' => 'dokumen_lembaga'] as $tipe => $tabel) {
            foreach (DB::table($tabel)->select('id', 'nama_file')->cursor() as $row) {
                $jalur = NamaBerkasDokumen::jalur($tipe, $row->nama_file ?? null);
                $lokasi = ($jalur !== null && $disk->exists($jalur)) ? 'server' : 'lokal';
                DB::table($tabel)->where('id', $row->id)->update(['penyimpanan' => $lokasi]);
            }
        }
    }

    public function down(): void
    {
        foreach (['dokumen_santri', 'dokumen_pegawai', 'dokumen_lembaga'] as $tabel) {
            Schema::table($tabel, function (Blueprint $table): void {
                $table->dropColumn('penyimpanan');
            });
        }
    }
};
