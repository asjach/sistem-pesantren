<?php

namespace App\Providers;

use App\Models\Pembayaran;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\User;
use App\Policies\KeuanganPolicy;
use App\Policies\SantriPolicy;
use App\Policies\UserPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        Santri::class => SantriPolicy::class,
        User::class => UserPolicy::class,
        Tagihan::class => KeuanganPolicy::class,
        Pembayaran::class => KeuanganPolicy::class,
    ];

    public function boot(): void
    {
        $this->registerPolicies();
    }
}
