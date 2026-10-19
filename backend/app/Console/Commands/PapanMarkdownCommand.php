<?php

namespace App\Console\Commands;

use App\Services\PapanTulisUlang;
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
    public function handle(PapanMarkdown $generator, PapanTulisUlang $tulisUlang): int
    {
        $berkas = $this->berkas();

        if (! $this->option('tulis')) {
            return $this->pratinjau($generator, $berkas);
        }

        try {
            $hasil = $tulisUlang->jalankan($berkas);
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info($hasil['berubah']
            ? "Peta ditulis ulang dari papan: {$hasil['berkas']}"
            : 'Peta sudah selaras dengan papan; tidak ada yang diubah.');

        return self::SUCCESS;
    }

    /** Cetak markdown hasil papan tanpa menyentuh berkas. */
    private function pratinjau(PapanMarkdown $generator, string $berkas): int
    {
        if (! is_file($berkas)) {
            $this->error("Berkas peta tidak ditemukan: {$berkas}");

            return self::FAILURE;
        }

        try {
            [$kepala, $ekor] = PapanMarkdown::potong((string) file_get_contents($berkas));
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->line($generator->hasilkan($kepala, $ekor));

        return self::SUCCESS;
    }

    /** Lokasi berkas peta: opsi --berkas, atau lokasi bawaan. */
    private function berkas(): string
    {
        $opsi = $this->option('berkas');

        if (is_string($opsi) && trim($opsi) !== '') {
            return $opsi;
        }

        return PapanTulisUlang::berkasBawaan();
    }
}
