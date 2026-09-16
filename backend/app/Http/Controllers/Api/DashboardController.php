<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Kelas;
use App\Models\Lembaga;
use App\Models\TahunAjaran;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * FB-DASH-01: agregat ringan 1-call untuk dashboard desktop.
 * Bukan executive dashboard 504 — hanya hitungan + konteks aktif.
 */
class DashboardController extends Controller
{
    public function ringkasan(Request $request)
    {
        $auth = auth()->user();

        $lembagaQuery = Lembaga::tenantScope();
        if ($request->filled('lembaga_id')) {
            if (! $auth->canAccessLembaga((int) $request->input('lembaga_id'))) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
            $lembagaQuery->where('id', $request->input('lembaga_id'));
        }
        $lembagaIds = $lembagaQuery->pluck('id');

        // TA kini data pesantren (global): tampilkan satu TA aktif yang berlaku.
        $taAktif = TahunAjaran::aktif($lembagaIds->count() === 1 ? (int) $lembagaIds->first() : null);
        $tahunAktif = $taAktif ? collect([$taAktif->only(['id', 'lembaga_id', 'nama'])]) : collect();

        return response()->json([
            'lembaga' => $lembagaIds->count(),
            'pengguna' => (clone User::tenantScope())->count(),
            'tahun_ajaran_aktif' => $tahunAktif->count(),
            'kelas' => Kelas::whereIn('lembaga_id', $lembagaIds)->count(),
            'tahun_aktif' => $tahunAktif,
            // Placeholder modul lanjutan (santri/psb menyusul):
            'santri' => null,
            'antrean_psb' => null,
        ]);
    }
}
