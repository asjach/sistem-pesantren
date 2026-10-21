<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Rename istilah domain Peristiwa → Kegiatan Evaluatif tanpa mengubah data. */
return new class extends Migration
{
    private const TABEL_BER_FK = [
        'batch_cetak_rapor',
        'kkm_kegiatan',
        'komponen_nilai',
        'nilai_santri',
        'pengaturan_kartu_peserta',
        'pengaturan_nomor_peserta',
        'peserta_kegiatan_evaluatif',
        'rentang_predikat',
    ];

    public function up(): void
    {
        Schema::rename('peristiwa_nilai', 'kegiatan_evaluatif');
        Schema::rename('peserta_peristiwa_nilai', 'peserta_kegiatan_evaluatif');

        foreach (self::TABEL_BER_FK as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->renameColumn('peristiwa_id', 'kegiatan_evaluatif_id');
            });
        }

        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->renameColumn('peristiwa_sumber_id', 'kegiatan_evaluatif_sumber_id');
        });
    }

    public function down(): void
    {
        Schema::table('komponen_nilai', function (Blueprint $table) {
            $table->renameColumn('kegiatan_evaluatif_sumber_id', 'peristiwa_sumber_id');
        });

        foreach (array_reverse(self::TABEL_BER_FK) as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->renameColumn('kegiatan_evaluatif_id', 'peristiwa_id');
            });
        }

        Schema::rename('peserta_kegiatan_evaluatif', 'peserta_peristiwa_nilai');
        Schema::rename('kegiatan_evaluatif', 'peristiwa_nilai');
    }
};
