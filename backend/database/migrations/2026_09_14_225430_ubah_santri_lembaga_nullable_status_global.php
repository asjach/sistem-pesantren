<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * v1.10 — 101 Santri Master:
     * - `santri.lembaga_id` boleh NULL = santri legacy tanpa track (sumber kebenaran
     *   lembaga = `riwayat_belajar`; kolom ini cache lembaga primer terakhir).
     *   FK cascade -> nullOnDelete (hapus lembaga tidak ikut menghapus santri).
     * - `santri.status_global` turunan murni: true iff punya >=1 riwayat_belajar aktif;
     *   default false (santri legacy nonaktif sampai ditempatkan).
     * Backfill: status_global dihitung ulang dari riwayat aktif.
     */
    public function up(): void
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->dropForeign(['lembaga_id']);
        });

        Schema::table('santri', function (Blueprint $table) {
            $table->unsignedBigInteger('lembaga_id')->nullable()->change();
            $table->boolean('status_global')->default(false)->change();
        });

        Schema::table('santri', function (Blueprint $table) {
            $table->foreign('lembaga_id')->references('id')->on('lembaga')->nullOnDelete();
        });

        DB::table('santri')->update(['status_global' => false]);
        DB::table('santri')->whereExists(function ($q) {
            $q->select(DB::raw(1))
                ->from('riwayat_belajar')
                ->whereColumn('riwayat_belajar.santri_id', 'santri.id')
                ->where('riwayat_belajar.is_aktif', true);
        })->update(['status_global' => true]);
    }

    /**
     * Kembalikan FK cascade + default lama. NOT NULL sengaja TIDAK dipulihkan
     * (baris legacy bisa berisi NULL dan tidak punya riwayat untuk diisi).
     */
    public function down(): void
    {
        Schema::table('santri', function (Blueprint $table) {
            $table->dropForeign(['lembaga_id']);
        });

        Schema::table('santri', function (Blueprint $table) {
            $table->boolean('status_global')->default(true)->change();
        });

        Schema::table('santri', function (Blueprint $table) {
            $table->foreign('lembaga_id')->references('id')->on('lembaga')->cascadeOnDelete();
        });
    }
};
