<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Symfony\Component\HttpFoundation\Response;

class IzinDokumen
{
    public function handle(Request $request, Closure $next, string $aksi): Response
    {
        $tipe = $request->route('tipe');
        abort_unless(in_array($tipe, ['santri', 'pegawai', 'lembaga'], true), 404);

        return app(PermissionMiddleware::class)->handle($request, $next, "dokumen_{$tipe}.{$aksi}");
    }
}
