<?php

namespace App\Console\Commands;

use App\Services\PapanService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('papan:lihat {kode? : Batasi ke satu sub-modul, mis. E.3} {--riwayat : Tampilkan riwayat perpindahan status}')]
#[Description('Baca papan perkembangan proyek: daftar modul, sub-modul, dan butirnya.')]
class PapanLihat extends Command
{
    /** Tampilkan papan; tanpa argumen cetak semuanya. */
    public function handle(PapanService $papan): int
    {
        if ($this->option('riwayat')) {
            return $this->cetakRiwayat($papan);
        }

        $kode = $this->argument('kode');

        if (is_string($kode) && $kode !== '') {
            return $this->cetakSatu($papan, $kode);
        }

        return $this->cetakSemua($papan);
    }

    /** Cetak satu sub-modul beserta butirnya. */
    private function cetakSatu(PapanService $papan, string $kode): int
    {
        $item = $papan->item($kode);

        $this->line("<options=bold>{$item->kode} {$item->nama}</>  [<options=bold>{$item->status}</>]");
        $this->line("Modul: {$item->modul->nama}");
        $this->newLine();

        foreach (PapanService::STATUS as $status) {
            $butir = $item->butir->where('status', $status);

            if ($butir->isEmpty()) {
                continue;
            }

            $this->line("<options=bold>{$status}</>");

            foreach ($butir as $b) {
                $this->line("  <fg=gray>#{$b->id}</> {$b->deskripsi}");
            }

            $this->newLine();
        }

        return self::SUCCESS;
    }

    /** Cetak seluruh papan dikelompokkan per modul. */
    private function cetakSemua(PapanService $papan): int
    {
        foreach ($papan->semua() as $modul) {
            $this->line("<options=bold>{$modul['kode']}. {$modul['nama']}</>");

            foreach ($modul['sub'] as $sub) {
                // Tampilkan sebaran poin per status di sebelah nama, supaya
                // kelihatan kenapa status turunannya begitu (mis. "akan" karena
                // masih ada 2 poin yang belum selesai).
                $ada = [];
                foreach ($sub['butir'] as $b) {
                    $ada[$b['status']] = ($ada[$b['status']] ?? 0) + 1;
                }

                $rinci = [];
                foreach (PapanService::STATUS as $s) {
                    if (($ada[$s] ?? 0) > 0) {
                        $rinci[] = "{$s}:{$ada[$s]}";
                    }
                }

                $this->line(sprintf(
                    '  %-5s [%-7s] %-38s <fg=gray>(%d poin%s)</>',
                    $sub['kode'],
                    $sub['status'],
                    mb_strimwidth($sub['nama'], 0, 38, '…'),
                    count($sub['butir']),
                    $rinci === [] ? '' : ' — '.implode(' ', $rinci),
                ));
            }

            $this->newLine();
        }

        $ringkasan = $papan->ringkasan();

        // Dua ringkasan ditampilkan terpisah: yang bergerak di papan adalah
        // POIN, sedangkan jumlah sub-modul cuma gambaran turunannya.
        $this->line('Poin     : '.collect($ringkasan['butir'])
            ->map(fn (int $jumlah, string $status) => "{$status}={$jumlah}")
            ->implode('  '));

        $this->line('Sub-modul: '.collect($ringkasan['sub'])
            ->map(fn (int $jumlah, string $status) => "{$status}={$jumlah}")
            ->implode('  '));

        return self::SUCCESS;
    }

    /** Cetak riwayat perpindahan status, terbaru lebih dulu. */
    private function cetakRiwayat(PapanService $papan): int
    {
        $kode = $this->argument('kode');
        $baris = $papan->riwayat(is_string($kode) && $kode !== '' ? $kode : null);

        if ($baris === []) {
            $this->info('Belum ada perpindahan status yang tercatat.');

            return self::SUCCESS;
        }

        foreach ($baris as $r) {
            $this->line(sprintf(
                '%s  %-5s  %s -> %s  <fg=gray>(%s)%s</>',
                $r['waktu'],
                $r['kode'],
                $r['dari'] ?? '-',
                $r['ke'],
                $r['oleh'],
                $r['catatan'] !== null ? ' '.$r['catatan'] : '',
            ));
        }

        return self::SUCCESS;
    }
}
