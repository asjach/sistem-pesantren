<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement("ALTER TABLE lembaga MODIFY kelompok_psb ENUM('combo_mi_md','eksklusif_mts','eksklusif') NOT NULL DEFAULT 'combo_mi_md'");
        DB::table('lembaga')->where('kelompok_psb', 'eksklusif_mts')->update(['kelompok_psb' => 'eksklusif']);
        DB::table('lembaga')->where('kelompok_psb', 'combo_mi_md')
            ->whereNotIn('kode', ['MI', 'MD'])
            ->update(['kelompok_psb' => 'eksklusif']);
        DB::statement("ALTER TABLE lembaga MODIFY kelompok_psb ENUM('combo_mi_md','eksklusif') NOT NULL DEFAULT 'eksklusif'");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement("ALTER TABLE lembaga MODIFY kelompok_psb ENUM('combo_mi_md','eksklusif_mts','eksklusif') NOT NULL DEFAULT 'combo_mi_md'");
        DB::table('lembaga')->where('kelompok_psb', 'eksklusif')->update(['kelompok_psb' => 'eksklusif_mts']);
        DB::statement("ALTER TABLE lembaga MODIFY kelompok_psb ENUM('combo_mi_md','eksklusif_mts') NOT NULL DEFAULT 'combo_mi_md'");
    }
};
