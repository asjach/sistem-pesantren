<?php

namespace App\Console\Commands;

use App\Services\PapanService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

#[Signature('papan:catat {kode : Kode sub-modul} {id : ID poin} {jenis : persetujuan|revisi|verifikasi|keputusan|catatan} {--teks= : Isi catatan atau persetujuan nyata pengguna}')]
#[Description('Tambahkan catatan pada poin tanpa mengubah acceptance criteria atau status.')]
class PapanCatat extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(PapanService $papan): int
    {
        if (! ctype_digit((string) $this->argument('id'))) {
            $this->error('ID poin harus angka.');

            return self::FAILURE;
        }
        try {
            $butir = $papan->catatButir((string) $this->argument('kode'), (int) $this->argument('id'),
                (string) $this->argument('jenis'), (string) $this->option('teks'));
        } catch (ValidationException $e) {
            $this->error(implode(' ', array_merge(...array_values($e->errors()))));

            return self::FAILURE;
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        $this->line(json_encode($butir->toArray(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
