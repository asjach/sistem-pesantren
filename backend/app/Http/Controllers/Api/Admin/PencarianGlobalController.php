<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\PencarianGlobal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PencarianGlobalController extends Controller
{
    public function __construct(private readonly PencarianGlobal $pencarian) {}

    /** Setelan halaman yang ikut pencarian global. */
    public function setelan(): JsonResponse
    {
        return response()->json(['data' => $this->pencarian->setelan()]);
    }

    public function simpan(Request $request): JsonResponse
    {
        $valid = $request->validate([
            'aktif' => ['required', 'array'],
            'aktif.*' => ['boolean'],
        ]);

        return response()->json([
            'pesan' => 'Pengaturan pencarian global disimpan.',
            'data' => $this->pencarian->simpan($valid['aktif'], (int) $request->user()->id),
        ]);
    }

    public function cari(Request $request): JsonResponse
    {
        $valid = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100'],
        ]);

        return response()->json([
            'hasil' => $this->pencarian->cari($valid['q'], $request->user()),
        ]);
    }
}
