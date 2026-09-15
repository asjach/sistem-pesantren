<?php

namespace App\Providers;

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
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Fallback pemuat helper global (utama via composer.json "files" + dump-autoload).
        if (! function_exists('terbilang')) {
            $helper = app_path('Helpers/TerbilangHelper.php');
            if (is_file($helper)) {
                require_once $helper;
            }
        }

        // Di lingkungan local throttle dilepas agar siklus kerja dev (refresh
        // berkali-kali demi cek tampilan, uji import berulang) tidak mentok 429.
        // Gate hanya 'local': produksi & testing tetap memakai batas normal.
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
}
