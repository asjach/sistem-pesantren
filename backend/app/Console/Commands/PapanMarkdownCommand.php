<?php

namespace App\Console\Commands;

use App\Support\PapanMarkdown;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use RuntimeException;

#[Signature('papan:markdown
    {--tulis : Tulis ulang berkasnya (tanpa ini hanya menampilkan pratinjau)}
    {--berkas= : Lokasi berkas peta, default docs/PETA-MODUL.md}')]
#[Description('Hasilkan ulang docs/PETA-MODUL.md dari isi papan (markdown sebagai turunan).')]
class PapanMarkdownCommand extends Command
{
    /** Hasilkan markdown dari papan; tulis hanya bila --tulis diberikan. */
    public function handle(PapanMarkdown $generator): int
    {
        $berkas = $this->berkas();

        if (! is_file($berkas)) {
            $this->error("Berkas peta tidak ditemukan: {$berkas}");

            return self::FAILURE;
        }

        $lama = (string) file_get_contents($berkas);

        try {
            [$kepala, $ekor] = PapanMarkdown::potong($lama);
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $baru = $generator->hasilkan($kepala, $ekor);

        if (! $this->option('tulis')) {
            $this->line($baru);

            return self::SUCCESS;
        }

        if ($baru === $lama) {
            $this->info('Peta sudah selaras dengan papan; tidak ada yang diubah.');

            return self::SUCCESS;
        }

        file_put_contents($berkas, $baru);

        $this->info("Peta ditulis ulang dari papan: {$berkas}");

        return self::SUCCESS;
    }

    /** Lokasi berkas peta: opsi --berkas, atau docs/PETA-MODUL.md repo. */
    private function berkas(): string
    {
        $opsi = $this->option('berkas');

        if (is_string($opsi) && trim($opsi) !== '') {
            return $opsi;
        }

        return dirname(base_path()).'/docs/PETA-MODUL.md';
    }
}
