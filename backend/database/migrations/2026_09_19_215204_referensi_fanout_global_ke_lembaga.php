<?php

use App\Services\RefService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fan-out nilai global ke tiap lembaga: super_admin menulis
     * ke semua lembaga sekaligus — tidak ada lagi baris global
     * (`jenjang` null). Lembaga yang sudah punya kunci yang sama
     * (termasuk bayangan nonaktif) dibiarkan apa adanya.
     */
    public function up(): void
    {
        $lembagas = DB::table('lembaga')->pluck('jenjang')->all();
        $daftars = [];
        foreach (RefService::KEY as $tipe => $kunci) {
            $daftars[] = ['ref_'.$tipe, $kunci];
        }
        $daftars[] = ['ref_alamat', 'nama'];

        foreach ($daftars as [$table, $key]) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            $globals = DB::table($table)->whereNull('jenjang')->get();
            foreach ($globals as $g) {
                $g = (array) $g;
                foreach ($lembagas as $lid) {
                    $ada = DB::table($table)
                        ->where('jenjang', $lid)
                        ->where($key, $g[$key])
                        ->exists();
                    if ($ada) {
                        continue;
                    }
                    $baris = $g;
                    unset($baris['id']);
                    $baris['jenjang'] = $lid;
                    DB::table($table)->insert($baris);
                }
            }
            DB::table($table)->whereNull('jenjang')->delete();
        }
    }

    public function down(): void
    {
        // Tidak reversibel: salinan per-lembaga telah menyimpang masing-masing.
    }
};
