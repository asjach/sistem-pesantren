<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Console\Command\Command;
use Tests\TestCase;

/**
 * Penjaga keselamatan `dev:reset`: perintah yang menghapus SELURUH tabel
 * harus menolak production dan benar-benar berhenti saat konfirmasi dijawab
 * tidak. Baris penanda di tabel `cache` mendeteksi bila `migrate:fresh`
 * sempat berjalan (baris akan hilang).
 */
class DevResetCommandTest extends TestCase
{
    use RefreshDatabase;

    private const KUNCI_PENANDA = 'penanda-dev-reset';

    private function tandai(): void
    {
        DB::table('cache')->insert([
            'key' => self::KUNCI_PENANDA,
            'value' => 'ada',
            'expiration' => now()->addDay()->getTimestamp(),
        ]);
    }

    private function masihAda(): bool
    {
        return DB::table('cache')->where('key', self::KUNCI_PENANDA)->exists();
    }

    public function test_ditolak_di_production_tanpa_menyentuh_db(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $this->tandai();

        $this->artisan('dev:reset')
            ->expectsOutputToContain('production')
            ->assertExitCode(Command::FAILURE);

        $this->assertTrue($this->masihAda(), 'DB tidak boleh tersentuh di production.');
    }

    public function test_konfirmasi_dijawab_tidak_membatalkan_tanpa_menyentuh_db(): void
    {
        $this->tandai();

        $this->artisan('dev:reset')
            ->expectsConfirmation('Semua tabel akan dihapus lalu di-seed ulang. Lanjutkan?', 'no')
            ->assertExitCode(Command::SUCCESS);

        $this->assertTrue($this->masihAda(), 'DB tidak boleh tersentuh saat konfirmasi dibatalkan.');
    }
}
