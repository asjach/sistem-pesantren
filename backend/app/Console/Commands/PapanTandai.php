<?php

namespace App\Console\Commands;

use App\Services\PapanService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use InvalidArgumentException;

#[Signature('papan:tandai
    {kode : Kode sub-modul, mis. E.3}
    {status : sudah | sedang | akan | ditunda}
    {--catatan= : Alasan singkat perpindahan}
    {--oleh=agent : Pencatat: agent atau pengguna}')]
#[Description('Pindahkan status sebuah sub-modul di papan perkembangan proyek.')]
class PapanTandai extends Command
{
    /** Ubah status sub-modul dan catat jejaknya. */
    public function handle(PapanService $papan): int
    {
        $kode = (string) $this->argument('kode');
        $status = (string) $this->argument('status');
        $oleh = (string) $this->option('oleh');
        $catatan = $this->option('catatan');
        $catatan = is_string($catatan) && trim($catatan) !== '' ? trim($catatan) : null;

        try {
            $item = $papan->pindah($kode, $status, $oleh, $catatan);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("{$item->kode} {$item->nama} -> {$item->status}");

        return self::SUCCESS;
    }
}
