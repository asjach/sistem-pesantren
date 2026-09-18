<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ToolbarPresetHapusRequest;
use App\Http\Requests\Admin\ToolbarPresetIndexRequest;
use App\Http\Requests\Admin\ToolbarPresetSimpanRequest;
use App\Models\ToolbarPreset;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * Visibilitas kontrol toolbar generik, GLOBAL per `table_key` (satu baris =
 * peta kontrol → boolean). Baca bebas (semua admin, agar semua peramban
 * merender sama); tulis khusus super_admin untuk seluruh lembaga.
 */
class ToolbarPresetController extends Controller
{
    /** Kunci kontrol yang dikenal frontend (di luar ini ditolak). */
    public const KUNCI = ['cari', 'info', 'urut', 'kolom', 'filter'];

    /** GET /api/admin/toolbar-preset?table_key=santri */
    public function index(ToolbarPresetIndexRequest $request): JsonResponse
    {
        $data = $request->validated();

        $row = ToolbarPreset::where('table_key', $data['table_key'])->first();

        return response()->json([
            'pesan' => 'Visibilitas toolbar dimuat.',
            'data' => [
                'table_key' => $data['table_key'],
                'visibilitas' => $row?->visibilitas ?? [],
            ],
        ]);
    }

    /** PUT /api/admin/toolbar-preset — upsert peta visibilitas satu tabel. */
    public function simpan(ToolbarPresetSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();

        $normal = [];
        foreach ($data['visibilitas'] as $kunci => $nilai) {
            if (! in_array($kunci, self::KUNCI, true)) {
                throw ValidationException::withMessages([
                    'visibilitas' => "Kunci kontrol \"{$kunci}\" tidak dikenal.",
                ]);
            }
            $normal[$kunci] = (bool) $nilai;
        }

        $row = ToolbarPreset::updateOrCreate(
            ['table_key' => $data['table_key']],
            ['visibilitas' => $normal, 'dibuat_oleh' => $request->user()->id],
        );

        return response()->json(['pesan' => 'Visibilitas toolbar disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/toolbar-preset?table_key=santri — kembali tampil semua. */
    public function hapus(ToolbarPresetHapusRequest $request): JsonResponse
    {
        $data = $request->validated();

        ToolbarPreset::where('table_key', $data['table_key'])->delete();

        return response()->json(['pesan' => 'Visibilitas toolbar dikembalikan ke bawaan (semua tampil).']);
    }
}
