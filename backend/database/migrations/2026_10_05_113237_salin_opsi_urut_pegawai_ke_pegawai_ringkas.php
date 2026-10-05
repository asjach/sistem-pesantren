<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Tabel `pegawai` di Lembaga Pegawai di-rename menjadi `pegawai_ringkas`:
     * salin opsi urut yang sudah ada (termasuk kustomisasi super_admin) agar
     * dropdown Urutkan langsung berfungsi lagi. Baris tujuan yang sudah ada
     * tidak ditimpa.
     */
    public function up(): void
    {
        if (DB::table('urut_preset')->where('table_key', 'pegawai_ringkas')->exists()) {
            return;
        }

        $sumber = DB::table('urut_preset')->where('table_key', 'pegawai')->first();
        if ($sumber === null) {
            return;
        }

        $sekarang = now();
        DB::table('urut_preset')->insert([
            'table_key' => 'pegawai_ringkas',
            'opsi' => $sumber->opsi,
            'dibuat_oleh' => $sumber->dibuat_oleh,
            'created_at' => $sekarang,
            'updated_at' => $sekarang,
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('urut_preset')->where('table_key', 'pegawai_ringkas')->delete();
    }
};
