<?php

namespace App\Providers;

use App\Konteks\LembagaAktif;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {

        $this->app->singleton(LembagaAktif::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Berkas SQLite papan dibuat otomatis bila belum ada, supaya perintah
        // `migrate --database=papan` tidak gagal di mesin baru (Laravel tidak
        // membuat berkas SQLite sendiri di luar `database.sqlite` bawaan).
        $this->siapkanBerkasPapan();

        if (! function_exists('terbilang')) {
            $helper = app_path('Helpers/TerbilangHelper.php');
            if (is_file($helper)) {
                require_once $helper;
            }
        }

        $longgar = app()->isLocal();

        RateLimiter::for('login', function (Request $request) use ($longgar) {
            if ($longgar) {
                return Limit::none();
            }

            $identifier = Str::transliterate(Str::lower((string) $request->input('identifier')));

            return Limit::perMinute(6)->by($identifier.'|'.$request->ip());
        });

        RateLimiter::for('api_user', function (Request $request) use ($longgar) {
            if ($longgar) {
                return Limit::none();
            }

            return Limit::perMinute(120)->by($request->user()?->getAuthIdentifier() ?: $request->ip());
        });

        RateLimiter::for('imports', function (Request $request) use ($longgar) {
            if ($longgar) {
                return Limit::none();
            }

            return Limit::perMinute(10)->by($request->user()?->getAuthIdentifier() ?: $request->ip());
        });
    }

    /**
     * Pastikan berkas SQLite papan ada.
     *
     * Papan proyek memakai koneksi `papan` (SQLite terpisah) agar tidak ikut
     * terhapus saat `migrate:fresh` DB pesantren. Laravel tidak membuat berkas
     * SQLite baru secara otomatis, jadi dibuat di sini sekali saja.
     */
    private function siapkanBerkasPapan(): void
    {
        $koneksi = config('database.connections.papan');

        if (($koneksi['driver'] ?? null) !== 'sqlite') {
            return;
        }

        $berkas = $koneksi['database'] ?? null;

        if (! is_string($berkas) || $berkas === ':memory:' || is_file($berkas)) {
            return;
        }

        $folder = dirname($berkas);

        if (is_dir($folder)) {
            touch($berkas);
        }
    }
}
