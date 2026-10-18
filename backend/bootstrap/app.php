<?php

use App\Http\Middleware\AktifLembaga;
use App\Support\GalatSkema;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
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

        /* Skema DB tertinggal (migrasi belum jalan) = galat operasional, bukan
           kesalahan pengguna. Jawab dengan pesan yang bisa ditindaklanjuti,
           bukan dump SQL mentah milik penanganan bawaan (yang di mode debug
           ikut memuat nama kolom/tabel dan nilai binding). Hanya SQLSTATE
           ketidakcocokan skema yang diambil alih; galat query lain tetap ke
           penanganan bawaan. */
        $exceptions->render(function (QueryException $e) {
            $pesan = GalatSkema::pesan($e);
            if ($pesan === null) {
                return null;
            }

            /* SQL saja (masih ber-placeholder) — JANGAN pesan exception-nya:
               `formatMessage` sudah menyisipkan nilai binding, yang bisa
               memuat data pribadi, ke dalam teks galat. */
            Log::warning('Skema database tertinggal', [
                'sqlstate' => GalatSkema::kode($e),
                'connection' => $e->connectionName,
                'sql' => mb_substr($e->getSql(), 0, 500),
            ]);

            return response()->json([
                'pesan' => $pesan,
                'kode' => GalatSkema::KODE,
            ], 503);
        });
    })->create();
