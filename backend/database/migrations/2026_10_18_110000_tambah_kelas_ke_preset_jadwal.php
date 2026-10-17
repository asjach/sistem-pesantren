<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Preset kolom "Lengkap" tabel jadwal yang sudah tersimpan sebelum kolom
 * __kelas ada tetap menampilkan kolom Kelas (paling depan) untuk tampilan
 * gabungan beberapa kelas. Preset lain tidak diubah.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('preset_tabel')
            ->where('table_key', 'kurikulum_jadwal')
            ->where('nama', 'Lengkap')
            ->get()
            ->each(function (object $row): void {
                $kolom = json_decode((string) $row->kolom, true);
                if (! is_array($kolom) || in_array('__kelas', $kolom, true)) {
                    return;
                }
                array_unshift($kolom, '__kelas');
                DB::table('preset_tabel')->where('id', $row->id)->update([
                    'kolom' => json_encode($kolom),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        // Tidak dikembalikan: pengguna mungkin sudah memakai kolom Kelas.
    }
};
