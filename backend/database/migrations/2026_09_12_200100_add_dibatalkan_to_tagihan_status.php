<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE tagihan MODIFY status ENUM('belum_bayar','mencicil','lunas','dibatalkan') NOT NULL DEFAULT 'belum_bayar'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE tagihan MODIFY status ENUM('belum_bayar','mencicil','lunas') NOT NULL DEFAULT 'belum_bayar'");
        }
    }
};
