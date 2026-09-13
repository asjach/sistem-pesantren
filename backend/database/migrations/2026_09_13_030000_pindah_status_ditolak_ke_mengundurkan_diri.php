<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Pengunduran diri kini punya status sendiri ('mengundurkan_diri'), bukan lagi 'ditolak'.
 * Pindahkan data lama: status calon + jejak log status ('dari'/'ke').
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('psb_calon_santri')
            ->where('status_pendaftaran', 'ditolak')
            ->update(['status_pendaftaran' => 'mengundurkan_diri']);

        DB::table('psb_log_status')->where('dari', 'ditolak')->update(['dari' => 'mengundurkan_diri']);
        DB::table('psb_log_status')->where('ke', 'ditolak')->update(['ke' => 'mengundurkan_diri']);
    }

    public function down(): void
    {
        DB::table('psb_calon_santri')
            ->where('status_pendaftaran', 'mengundurkan_diri')
            ->update(['status_pendaftaran' => 'ditolak']);

        DB::table('psb_log_status')->where('dari', 'mengundurkan_diri')->update(['dari' => 'ditolak']);
        DB::table('psb_log_status')->where('ke', 'mengundurkan_diri')->update(['ke' => 'ditolak']);
    }
};
