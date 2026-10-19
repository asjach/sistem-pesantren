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
                $jumlah = count($sub['butir']);
                $this->line(sprintf(
                    '  %-5s [%-7s] %s <fg=gray>(%d butir)</>',
                    $sub['kode'],
                    $sub['status'],
                    $sub['nama'],
                    $jumlah,
                ));
            }

            $this->newLine();
        }

        $ringkasan = $papan->ringkasan();

        $this->line('Ringkasan: '.collect($ringkasan)
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
