<?php

use App\Services\RefService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fan-out nilai global ke tiap lembaga operasional: super_admin menulis
     * ke semua lembaga sekaligus — tidak ada lagi baris global
     * (`lembaga_id` null). Lembaga yang sudah punya kunci yang sama
     * (termasuk bayangan nonaktif) dibiarkan apa adanya.
     */
    public function up(): void
    {
        $lembagas = DB::table('lembaga')->whereNotNull('parent_id')->pluck('id')->all();
        $daftars = [];
        foreach (RefService::KEY as $tipe => $kunci) {
            $daftars[] = ['ref_'.$tipe, $kunci];
        }
        $daftars[] = ['ref_alamat', 'nama'];

        foreach ($daftars as [$table, $key]) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            $globals = DB::table($table)->whereNull('lembaga_id')->get();
            foreach ($globals as $g) {
                $g = (array) $g;
                foreach ($lembagas as $lid) {
                    $ada = DB::table($table)
                        ->where('lembaga_id', $lid)
                        ->where($key, $g[$key])
                        ->exists();
                    if ($ada) {
                        continue;
                    }
                    $baris = $g;
                    unset($baris['id']);
                    $baris['lembaga_id'] = $lid;
                    DB::table($table)->insert($baris);
                }
            }
            DB::table($table)->whereNull('lembaga_id')->delete();
        }
    }

    public function down(): void
    {
        // Tidak reversibel: salinan per-lembaga telah menyimpang masing-masing.
    }
};
