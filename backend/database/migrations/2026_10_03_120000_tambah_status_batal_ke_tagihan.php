<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Modul keuangan belum rilis; migrasi awal sudah memuat 'batal'.
        // ALTER ini hanya untuk database yang sudah menjalankan migrasi awal.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `tagihan` MODIFY `status` ENUM('belum','sebagian','lunas','batal') NOT NULL DEFAULT 'belum'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `tagihan` MODIFY `status` ENUM('belum','sebagian','lunas') NOT NULL DEFAULT 'belum'");
        }
    }
};
