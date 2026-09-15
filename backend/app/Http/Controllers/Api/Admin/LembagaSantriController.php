<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\LembagaSantri;
use App\Models\Santri;
use App\Services\NisKemenagService;
use App\Services\PenerimaanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Keanggotaan santri per lembaga (`lembaga_santri`) — panel Buku Induk:
 * NIS lokal/kemenag, status aktif, tanggal mulai/selesai, generate NIS Kemenag.
 */
class LembagaSantriController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/santri/{santri}/lembaga — daftar keanggotaan santri. */
    public function index(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('view', $santri);

        return response()->json([
            'pesan' => 'Keanggotaan lembaga berhasil dimuat.',
            'data' => $santri->lembagaSantri()
                ->with('lembaga:id,nama,kode,nsm')
                ->orderByDesc('is_active')
                ->orderBy('id')
                ->get(),
        ]);
    }

    /** POST /api/admin/santri/{santri}/lembaga — buat/aktifkan keanggotaan. */
    public function store(Request $request, Santri $santri, PenerimaanService $penerimaan): JsonResponse
    {
        $this->authorize('update', $santri);

        $data = $request->validate([
            'lembaga_id' => ['required', Rule::exists('lembaga', 'id')->whereNotNull('parent_id')],
            'nis_lokal' => ['nullable', 'string', 'max:20'],
            'tgl_mulai' => ['nullable', 'date'],
        ]);
        $this->authorizeLembaga($request->user(), (int) $data['lembaga_id']);

        $keanggotaan = $penerimaan->pastikanKeanggotaan($santri, (int) $data['lembaga_id'], [
            'nis_lokal' => $data['nis_lokal'] ?? null,
            'tgl_mulai' => $data['tgl_mulai'] ?? null,
        ]);

        return response()->json(['pesan' => 'Keanggotaan lembaga disimpan.', 'data' => $keanggotaan], 201);
    }

    /** PATCH /api/admin/lembaga-santri/{lembagaSantri} — NIS/status/tanggal. */
    public function update(Request $request, LembagaSantri $lembagaSantri): JsonResponse
    {
        $this->authorizeLembaga($request->user(), (int) $lembagaSantri->lembaga_id);

        $data = $request->validate([
            'nis_lokal' => ['sometimes', 'nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
            'tgl_mulai' => ['sometimes', 'nullable', 'date'],
            'tgl_selesai' => ['sometimes', 'nullable', 'date'],
        ]);

        if (array_key_exists('nis_lokal', $data)) {
            $nis = trim((string) $data['nis_lokal']) ?: null;
            if (LembagaSantri::nisLokalDipakai((int) $lembagaSantri->lembaga_id, $nis, (int) $lembagaSantri->id)) {
                abort(422, 'NIS lokal sudah dipakai santri lain di lembaga ini.');
            }
            $data['nis_lokal'] = $nis;
        }

        $lembagaSantri->update($data);

        // Status aktif keanggotaan tidak otomatis mengubah riwayat; status_global tetap turunan riwayat.

        return response()->json(['pesan' => 'Keanggotaan diperbarui.', 'data' => $lembagaSantri->fresh()]);
    }

    /** POST /api/admin/lembaga-santri/{lembagaSantri}/generate-nisk — NIS Kemenag manual. */
    public function generateNisk(Request $request, LembagaSantri $lembagaSantri, NisKemenagService $service): JsonResponse
    {
        $this->authorizeLembaga($request->user(), (int) $lembagaSantri->lembaga_id);

        $hasil = $service->generate($lembagaSantri);

        return response()->json([
            'pesan' => 'NIS Kemenag digenerate.',
            'data' => $hasil,
        ], 201);
    }
}
