<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Kembalikan enum seperti semula (soft-delete batal dibatalkan,
        // tagihan dihapus permanen). Hanya untuk database yang sudah
        // menjalankan migrasi 2026_10_03_120000.
        // Baris 'batal' sisa uji coba ikut terhapus (tak ada pembayaran aktif
        // di dalamnya — batal mensyaratkan itu).
        DB::table('tagihan')->where('status', 'batal')->delete();
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `tagihan` MODIFY `status` ENUM('belum','sebagian','lunas') NOT NULL DEFAULT 'belum'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `tagihan` MODIFY `status` ENUM('belum','sebagian','lunas','batal') NOT NULL DEFAULT 'belum'");
        }
    }
};
