<?php

namespace App\Console\Commands;

use Database\Seeders\DevSeeder;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('dev:reset {--force : Lewati konfirmasi (tetap ditolak di production)}')]
#[Description('Siapkan ulang lingkungan dev: migrate:fresh --seed lalu DevSeeder.')]
class DevReset extends Command
{
    /**
     * Bangun ulang skema + data dev sekali jalan. Menghapus SELURUH tabel,
     * jadi dilarang di production dan meminta konfirmasi kecuali `--force`.
     */
    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->error('dev:reset dilarang di lingkungan production.');

            return self::FAILURE;
        }

        if (! $this->option('force') && ! $this->confirm('Semua tabel akan dihapus lalu di-seed ulang. Lanjutkan?', false)) {
            $this->warn('Dibatalkan.');

            return self::SUCCESS;
        }

        $this->call('migrate:fresh', ['--seed' => true, '--force' => true]);
        // RoleSeeder sudah jalan via DatabaseSeeder; DevSeeder melengkapi
        // kamus per lembaga + akun dev (semua idempoten).
        $this->call('db:seed', ['--class' => DevSeeder::class, '--force' => true]);

        $this->newLine();
        $this->info('dev:reset selesai — skema + data dev siap.');

        return self::SUCCESS;
    }
}
