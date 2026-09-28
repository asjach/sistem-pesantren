<?php

use App\Http\Middleware\AktifLembaga;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Laravel mendaftarkan redirect tamu ke route('login') sebagai bawaan.
        // Aplikasi ini tidak punya route tersebut karena autentikasi sepenuhnya
        // lewat API, jadi setiap permintaan tanpa token yang bukan JSON (unduhan
        // dan unggahan memakai `Accept: */*`) akan menjawab 500, bukan 401.
        // Dengan null, permintaan API ditangani shouldRenderJsonWhen di bawah.
        $middleware->redirectGuestsTo(null);

        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'lembaga_aktif' => AktifLembaga::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
