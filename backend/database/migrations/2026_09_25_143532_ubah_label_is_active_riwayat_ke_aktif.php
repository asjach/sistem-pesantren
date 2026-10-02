<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('label_kolom')
            ->where('tabel', 'riwayat_belajar')
            ->where('kolom', 'is_active_riwayat')
            ->update(['label' => 'AKTIF', 'updated_at' => now()]);

    }

    public function down(): void
    {
        DB::table('label_kolom')
            ->where('tabel', 'riwayat_belajar')
            ->where('kolom', 'is_active_riwayat')
            ->update(['label' => 'Is Active Riwayat', 'updated_at' => now()]);

    }
};
