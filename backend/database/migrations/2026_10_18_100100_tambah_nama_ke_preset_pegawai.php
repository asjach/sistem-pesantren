<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Preset kolom "Lengkap" untuk tabel pegawai yang sudah tersimpan sebelum
 * kolom nama_panggilan/nama_singkat ada tetap menampilkan kolom baru itu.
 * Preset lain (buatan pengguna) tidak diubah.
 */
return new class extends Migration
{
    public function up(): void
    {
        $baru = ['nama_panggilan', 'nama_singkat'];

        DB::table('preset_tabel')
            ->where('table_key', 'pegawai')
            ->where('nama', 'Lengkap')
            ->get()
            ->each(function (object $row) use ($baru): void {
                $kolom = json_decode((string) $row->kolom, true);
                if (! is_array($kolom)) {
                    return;
                }
                if (array_intersect($baru, $kolom) === []) {
                    $posisi = array_search('nama_lengkap', $kolom, true);
                    if ($posisi === false) {
                        $kolom = [...$kolom, ...$baru];
                    } else {
                        array_splice($kolom, $posisi + 1, 0, $baru);
                    }
                }
                DB::table('preset_tabel')->where('id', $row->id)->update([
                    'kolom' => json_encode($kolom),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {

    }
};
