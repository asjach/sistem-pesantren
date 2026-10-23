<?php

namespace App\Console\Commands;

use App\Services\PapanService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('papan:lihat {kode? : Batasi ke satu sub-modul, mis. DA1.1} {--riwayat : Tampilkan riwayat perpindahan status} {--json : Keluarkan JSON lengkap tanpa mengubah data}')]
#[Description('Baca papan perkembangan proyek per aplikasi: modul, sub-modul, dan butirnya.')]
class PapanLihat extends Command
{
    /** Tampilkan papan; tanpa argumen cetak semuanya. */
    public function handle(PapanService $papan): int
    {
        if ($this->option('json')) {
            $kode = $this->argument('kode');
            $aplikasi = $papan->semuaAplikasi();
            if (is_string($kode) && $kode !== '') {
                $papan->item($kode);
                foreach ($aplikasi as &$app) {
                    foreach ($app['modul'] as &$modul) {
                        $modul['sub'] = array_values(array_filter($modul['sub'], fn ($sub) => $sub['kode'] === $kode));
                    }
                    unset($modul);
                    $app['modul'] = array_values(array_filter($app['modul'], fn ($m) => $m['sub'] !== []));
                }
                unset($app);
                $aplikasi = array_values(array_filter($aplikasi, fn ($a) => $a['modul'] !== []));
            }
            $this->line(json_encode([
                'workflow_master_aktif' => $papan->workflowMasterAktif(),
                'aplikasi' => $aplikasi,
                'riwayat' => $this->option('riwayat') ? $papan->riwayat($kode ?: null) : [],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

            return self::SUCCESS;
        }
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

        $labelStatus = PapanService::LABEL_STATUS[$item->status] ?? $item->status;
        $this->line("<options=bold>{$item->kode} {$item->nama}</>  [<options=bold>{$labelStatus}</>]");
        $this->line('Aplikasi: '.(PapanService::APLIKASI[$item->modul->aplikasi] ?? $item->modul->aplikasi));
        $this->line("Modul: {$item->modul->nama}");
        $this->newLine();

        foreach (PapanService::STATUS as $status) {
            $butir = $item->butir->where('status', $status);

            if ($butir->isEmpty()) {
                continue;
            }

            $this->line('<options=bold>'.(PapanService::LABEL_STATUS[$status] ?? $status).'</>');

            foreach ($butir as $b) {
                $this->line("  <fg=gray>#{$b->id}</> {$b->deskripsi}");
                if (trim($b->keterangan ?? '') !== '') {
                    $this->line('    Requirement: '.$b->keterangan);
                }
                foreach ($b->subpoin ?? [] as $subpoin) {
                    $this->line('    ['.($subpoin['selesai'] ? 'x' : ' ').'] '.$subpoin['teks']);
                }
                foreach ($b->catatan ?? [] as $catatan) {
                    $this->line('    '.$catatan['jenis'].': '.$catatan['teks']);
                }
                foreach ($b->scope_versi ?? [] as $scope) {
                    $this->line('    Scope v'.$scope['versi'].' ('.$scope['jenis'].'): '.json_encode($scope, JSON_UNESCAPED_UNICODE));
                }
            }

            $this->newLine();
        }

        return self::SUCCESS;
    }

    /** Cetak seluruh papan dikelompokkan per aplikasi lalu modul. */
    private function cetakSemua(PapanService $papan): int
    {
        $status = $papan->statusWorkflow();
        $this->line('Alur kerja utama (Workflow master): <options=bold>'.($status['workflow_master_aktif'] ? 'AKTIF' : 'DRAF').'</>');

        foreach ($status['aplikasi'] as $kode => $aplikasi) {
            $this->line(sprintf(
                '  %-18s %-5s (efektif: %s)',
                PapanService::APLIKASI[$kode],
                $aplikasi['workflow_aktif'] ? 'AKTIF' : 'DRAF',
                $aplikasi['workflow_efektif'] ? 'AKTIF' : 'DRAF',
            ));
        }

        $this->newLine();

        foreach ($papan->semuaAplikasi() as $aplikasi) {
            $this->line("<options=bold>{$aplikasi['nama']}</>");

            foreach ($aplikasi['modul'] as $modul) {
                $this->line("  {$modul['kode']}. {$modul['nama']}");

                foreach ($modul['sub'] as $sub) {
                    // Tampilkan sebaran poin per status di sebelah nama, supaya
                    // kelihatan kenapa status turunannya begitu (mis. "todo" karena
                    // masih ada 2 poin yang belum selesai).
                    $ada = [];
                    foreach ($sub['butir'] as $b) {
                        $ada[$b['status']] = ($ada[$b['status']] ?? 0) + 1;
                    }

                    $rinci = [];
                    foreach (PapanService::STATUS as $s) {
                        if (($ada[$s] ?? 0) > 0) {
                            $rinci[] = (PapanService::LABEL_STATUS[$s] ?? $s).":{$ada[$s]}";
                        }
                    }

                    $this->line(sprintf(
                        '    %-7s [%s] %-38s <fg=gray>(%d poin%s)</>',
                        $sub['kode'],
                        PapanService::LABEL_STATUS[$sub['status']] ?? $sub['status'],
                        mb_strimwidth($sub['nama'], 0, 38, '…'),
                        count($sub['butir']),
                        $rinci === [] ? '' : ' — '.implode(' ', $rinci),
                    ));
                }
            }

            $this->newLine();
        }

        $ringkasan = $papan->ringkasan();

        // Dua ringkasan ditampilkan terpisah: yang bergerak di papan adalah
        // POIN, sedangkan jumlah sub-modul cuma gambaran turunannya.
        $this->line('Poin     : '.collect($ringkasan['butir'])
            ->map(fn (int $jumlah, string $status) => (PapanService::LABEL_STATUS[$status] ?? $status)."={$jumlah}")
            ->implode('  '));

        $this->line('Sub-modul: '.collect($ringkasan['sub'])
            ->map(fn (int $jumlah, string $status) => (PapanService::LABEL_STATUS[$status] ?? $status)."={$jumlah}")
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
                $r['dari'] === null ? '-' : (PapanService::LABEL_STATUS[$r['dari']] ?? $r['dari']),
                PapanService::LABEL_STATUS[$r['ke']] ?? $r['ke'],
                $r['oleh'],
                $r['catatan'] !== null ? ' '.$r['catatan'] : '',
            ));
        }

        return self::SUCCESS;
    }
}
