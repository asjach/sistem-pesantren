<?php

namespace App\Http\Middleware;

use App\Konteks\LembagaAktif;
use App\Models\Lembaga;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Mode "bertindak sebagai lembaga" (act-as) untuk super_admin: membaca header
 * `X-Lembaga-Aktif` lalu mengisi konteks request. Diabaikan untuk peran lain;
 * header tidak valid / lembaga tak dikenal ditolak 403.
 */
class AktifLembaga
{
    public function __construct(protected LembagaAktif $konteks) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Selalu mulai dari mode penuh; konteks hanya diisi bila header valid.
        $this->konteks->lupakan();

        $user = $request->user();
        $header = $request->header('X-Lembaga-Aktif');

        if ($user?->hasRole('super_admin') && $header !== null && trim($header) !== '') {
            $id = (int) $header;
            if ($id > 0) {
                if (! Lembaga::whereKey($id)->exists()) {
                    abort(403, 'Lembaga aktif tidak ditemukan.');
                }
                $this->konteks->set($id);
            }
        }

        return $next($request);
    }
}
