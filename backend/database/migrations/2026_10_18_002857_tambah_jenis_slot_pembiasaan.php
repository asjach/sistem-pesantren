<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jenis slot: pelajaran, istirahat, atau pembiasaan. Slot non-pelajaran tetap
 * tampil di matriks jadwal tetapi tidak bisa diisi mapel/guru.
 *
 * `template_jadwal_baris.is_istirahat` diganti `jenis` agar mendukung
 * pembiasaan; baris istirahat lama dipetakan ke jenis istirahat.
 */
return new class extends Migration
{
    private const JENIS = ['pelajaran', 'istirahat', 'pembiasaan'];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('slot_jam_pelajaran', function (Blueprint $table) {
            $table->enum('jenis', self::JENIS)->default('pelajaran')->after('nama_slot');
        });

        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->enum('jenis', self::JENIS)->default('pelajaran')->after('nama_slot');
        });

        DB::table('template_jadwal_baris')
            ->where('is_istirahat', true)
            ->update(['jenis' => 'istirahat']);

        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->dropColumn('is_istirahat');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->boolean('is_istirahat')->default(false)->after('jam_selesai');
        });

        DB::table('template_jadwal_baris')
            ->where('jenis', 'istirahat')
            ->update(['is_istirahat' => true]);

        Schema::table('template_jadwal_baris', function (Blueprint $table) {
            $table->dropColumn('jenis');
        });

        Schema::table('slot_jam_pelajaran', function (Blueprint $table) {
            $table->dropColumn('jenis');
        });
    }
};
