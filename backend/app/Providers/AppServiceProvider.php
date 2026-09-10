<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

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
            if (is_file($helper)) require_once $helper;
        }
    }
}
