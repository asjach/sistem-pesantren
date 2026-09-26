<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Arsip kelulusan boleh satu baris per santri PER LEMBAGA (santri bisa lulus
 * di MI sekaligus MD). Unique `santri_id` diganti `santri_id + lembaga_lulus`.
 */
return new class extends Migration
{
    private const LAMA = 'alumni_santri_id_unique';

    private const BARU = 'alumni_santri_id_lembaga_lulus_unique';

    public function up(): void
    {
        // Urutan penting: composite lebih dulu (santri_id = kolom paling kiri,
        // jadi FK tetap terpenuhi), baru unique lama dibuang — MySQL menolak
        // drop index yang masih dipakai FK.
        if (! Schema::hasIndex('alumni', self::BARU)) {
            Schema::table('alumni', function (Blueprint $table) {
                $table->unique(['santri_id', 'lembaga_lulus']);
            });
        }
        if (Schema::hasIndex('alumni', self::LAMA)) {
            Schema::table('alumni', function (Blueprint $table) {
                $table->dropUnique(self::LAMA);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasIndex('alumni', self::BARU)) {
            Schema::table('alumni', function (Blueprint $table) {
                $table->dropUnique(self::BARU);
            });
        }
        if (! Schema::hasIndex('alumni', self::LAMA)) {
            Schema::table('alumni', function (Blueprint $table) {
                $table->unique('santri_id');
            });
        }
    }
};
