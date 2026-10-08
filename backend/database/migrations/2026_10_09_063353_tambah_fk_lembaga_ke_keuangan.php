<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite (test) tak mendukung MODIFY/ADD FOREIGN KEY via ALTER —
        // FK ini penegakan MySQL produksi/dev; di sqlite dilewati.
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        // Samakan panjang dengan `lembaga.jenjang` (varchar 20) — syarat FK.
        // MODIFY dipakai agar tak bergantung doctrine/dbal.
        DB::statement('ALTER TABLE `jenis_tagihan` MODIFY `jenjang` VARCHAR(20) NULL');
        DB::statement('ALTER TABLE `tarif_tagihan` MODIFY `jenjang` VARCHAR(20) NOT NULL');
        DB::statement('ALTER TABLE `tagihan` MODIFY `jenjang` VARCHAR(20) NOT NULL');

        // Tenancy di level database: salah ketik jenjang ditolak sejak
        // INSERT; hapus lembaga yang masih punya data keuangan ditolak
        // (restrict — riwayat tagihan tak boleh ikut terhapus), rename
        // jenjang merambat (cascade update, seperti tabel lain).
        Schema::table('jenis_tagihan', function (Blueprint $table): void {
            $table->foreign('jenjang', 'jenis_tagihan_jenjang_foreign')
                ->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->restrictOnDelete();
        });
        Schema::table('tarif_tagihan', function (Blueprint $table): void {
            $table->foreign('jenjang', 'tarif_tagihan_jenjang_foreign')
                ->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->restrictOnDelete();
        });
        Schema::table('tagihan', function (Blueprint $table): void {
            $table->foreign('jenjang', 'tagihan_jenjang_foreign')
                ->references('jenjang')->on('lembaga')
                ->cascadeOnUpdate()->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        Schema::table('tagihan', function (Blueprint $table): void {
            $table->dropForeign('tagihan_jenjang_foreign');
        });
        Schema::table('tarif_tagihan', function (Blueprint $table): void {
            $table->dropForeign('tarif_tagihan_jenjang_foreign');
        });
        Schema::table('jenis_tagihan', function (Blueprint $table): void {
            $table->dropForeign('jenis_tagihan_jenjang_foreign');
        });

        DB::statement('ALTER TABLE `jenis_tagihan` MODIFY `jenjang` VARCHAR(50) NULL');
        DB::statement('ALTER TABLE `tarif_tagihan` MODIFY `jenjang` VARCHAR(50) NOT NULL');
        DB::statement('ALTER TABLE `tagihan` MODIFY `jenjang` VARCHAR(50) NOT NULL');
    }
};
