<?php

namespace App\Console\Commands;

use App\Services\PapanService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use InvalidArgumentException;

#[Signature('papan:tandai
    {kode : Kode sub-modul, mis. E.3}
    {id : Id poin (butir) yang dipindah}
    {status : sudah | sedang | akan | ditunda}
    {--catatan= : Alasan singkat perpindahan}
    {--oleh=agent : Pencatat: agent atau pengguna}')]
#[Description('Pindahkan status sebuah poin di papan perkembangan proyek.')]
class PapanTandai extends Command
{
    /** Ubah status poin dan catat jejaknya. */
    public function handle(PapanService $papan): int
    {
        $kode = (string) $this->argument('kode');
        $id = $this->argument('id');
        $status = (string) $this->argument('status');
        $oleh = (string) $this->option('oleh');
        $catatan = $this->option('catatan');
        $catatan = is_string($catatan) && trim($catatan) !== '' ? trim($catatan) : null;

        if (! is_numeric($id)) {
            $this->error('Argumen id harus angka, mis. " . P + "papan:tandai E.3 12 sedang" . P + ".');

            return self::FAILURE;
        }

        try {
            $butir = $papan->pindahButir($kode, (int) $id, $status, $oleh, $catatan);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info('Poin #'.$butir->id.' ('.$kode.'): '.$butir->deskripsi);

        // Status sub-modul ikut bergerak karena diturunkan dari poin, jadi
        // hasilnya perlu ditampilkan ulang supaya efeknya langsung terlihat.
        $sub = collect($papan->semua())
            ->flatMap(fn (array $m) => $m['sub'])
            ->firstWhere('kode', $kode);

        if ($sub !== null) {
            $this->line('  status poin      : '.$butir->status);
            $this->line('  status sub-modul : '.$sub['status'].' <fg=gray>(turunan)</>');
        }

        return self::SUCCESS;
    }
}
