<?php

use App\Support\JatuhTempo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Aturan jatuh tempo bulanan diubah: dari tanggal 10 BULAN BERIKUTNYA menjadi
 * tanggal 10 BULAN BERJALAN (periode 2025-07 → 2025-07-10, bukan 2025-08-10).
 *
 * Migrasi ini menulis ulang `jatuh_tempo` untuk tagihan jenis bulanan supaya
 * data yang sudah ada ikut aturan baru — kalau tidak, tagihan lama masih
 * memakai tanggal lama dan label "tunggakan" tidak sinkron dengan aturan.
 *
 * Non-bulanan tidak disentuh (jatuh tempo manual per tagihan).
 */
return new class extends Migration
{
    public function up(): void
    {
        $baris = DB::table('tagihan')
            ->join('jenis_tagihan', 'jenis_tagihan.id', '=', 'tagihan.jenis_id')
            ->where('jenis_tagihan.tipe', 'bulanan')
            ->whereNotNull('tagihan.periode')
            ->select(['tagihan.id', 'tagihan.periode'])
            ->get();

        $perBatch = [];
        foreach ($baris as $t) {
            $jatuh = JatuhTempo::bulanan($t->periode);
            if ($jatuh === null) {
                continue;
            }
            $perBatch[$t->id] = $jatuh;
        }

        foreach (array_chunk($perBatch, 500, true) as $chunk) {
            $cases = [];
            $params = [];
            foreach ($chunk as $id => $jatuh) {
                $cases[] = 'WHEN id = ? THEN ?';
                $params[] = $id;
                $params[] = $jatuh;
            }
            $ids = implode(',', array_fill(0, count($chunk), '?'));
            $sql = 'UPDATE tagihan SET jatuh_tempo = CASE '.implode(' ', $cases).' END WHERE id IN ('.$ids.')';
            DB::update($sql, array_merge($params, array_keys($chunk)));
        }
    }

    public function down(): void
    {
        // Aturan lama tidak direkonstruksi (nilai lama sudah tertimpa); dibiarkan.
    }
};
