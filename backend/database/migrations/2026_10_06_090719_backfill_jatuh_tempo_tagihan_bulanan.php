<?php

use App\Support\JatuhTempo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * isi ulang jatuh tempo tagihan jenis BULANAN.
 *
 * Sebelumnya satu tanggal jatuh tempo dipakai untuk semua periode sekaligus
 * generate, jadi tagihan Juli dan Agustus bisa punya tanggal yang sama —
 * "sudah jatuh tempo" tidak bisa dibedakan per bulan. Sekarang bulanan follows
 * aturan tetap: tanggal 10 bulan berikutnya.
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
        // Nilai lama tidak direkonstruksi (sudah tertimpa); dibiarkan.
    }
};
