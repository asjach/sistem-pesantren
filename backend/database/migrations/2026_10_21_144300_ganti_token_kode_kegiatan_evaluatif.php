<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Ganti token pola nomor lama {kode_peristiwa} ke {kode_kegiatan_evaluatif}. */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('pengaturan_nomor_peserta')
            ->where('template', 'like', '%{kode_peristiwa}%')
            ->update([
                'template' => DB::raw("REPLACE(template, '{kode_peristiwa}', '{kode_kegiatan_evaluatif}')"),
            ]);
    }

    public function down(): void
    {
        DB::table('pengaturan_nomor_peserta')
            ->where('template', 'like', '%{kode_kegiatan_evaluatif}%')
            ->update([
                'template' => DB::raw("REPLACE(template, '{kode_kegiatan_evaluatif}', '{kode_peristiwa}')"),
            ]);
    }
};
