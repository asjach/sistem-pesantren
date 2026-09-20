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

    /** Kunci kontrol yang punya pengaturan lebar (px). */
    public const KUNCI_LEBAR = ['cari', 'urut', 'kolom'];

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
                'lebar' => $row?->lebar ?? [],
                'urutan' => $row?->urutan ?? [],
            ],
        ]);
    }

    /** PUT /api/admin/toolbar-preset — upsert gabung: hanya kunci yang
     *  dikirim yang ditimpa (visibilitas/lebar/urutan independen). */
    public function simpan(ToolbarPresetSimpanRequest $request): JsonResponse
    {
        $data = $request->validated();

        if (! array_key_exists('visibilitas', $data) && ! array_key_exists('lebar', $data) && ! array_key_exists('urutan', $data)) {
            throw ValidationException::withMessages([
                'table_key' => 'Kirim minimal satu dari visibilitas, lebar, atau urutan.',
            ]);
        }

        $row = ToolbarPreset::firstOrNew(['table_key' => $data['table_key']]);

        // Kolom visibilitas NOT NULL: baris baru tanpa visibilitas = semua tampil.
        if ($row->visibilitas === null) {
            $row->visibilitas = [];
        }

        if (array_key_exists('visibilitas', $data)) {
            $normal = [];
            foreach ($data['visibilitas'] as $kunci => $nilai) {
                if (! in_array($kunci, self::KUNCI, true)) {
                    throw ValidationException::withMessages([
                        'visibilitas' => "Kunci kontrol \"{$kunci}\" tidak dikenal.",
                    ]);
                }
                $normal[$kunci] = (bool) $nilai;
            }
            $row->visibilitas = $normal;
        }

        if (array_key_exists('lebar', $data)) {
            $lebar = [];
            foreach ($data['lebar'] as $kunci => $nilai) {
                $isFilter = preg_match('/^filter\.[a-z0-9_]{1,60}$/', (string) $kunci) === 1;
                if (! in_array($kunci, self::KUNCI_LEBAR, true) && ! $isFilter) {
                    throw ValidationException::withMessages([
                        'lebar' => "Kunci lebar \"{$kunci}\" tidak dikenal.",
                    ]);
                }
                $lebar[$kunci] = (int) $nilai;
            }
            $row->lebar = $lebar === [] ? null : $lebar;
        }

        if (array_key_exists('urutan', $data)) {
            $urutan = [];
            foreach ($data['urutan'] as $kunci) {
                $kunci = strtolower(trim((string) $kunci));
                if ($kunci !== '' && ! in_array($kunci, $urutan, true)) {
                    $urutan[] = $kunci;
                }
            }
            $row->urutan = $urutan === [] ? null : $urutan;
        }

        $row->dibuat_oleh = $request->user()->id;
        $row->save();

        return response()->json(['pesan' => 'Toolbar disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/toolbar-preset?table_key=santri — kembali tampil semua. */
    public function hapus(ToolbarPresetHapusRequest $request): JsonResponse
    {
        $data = $request->validated();

        ToolbarPreset::where('table_key', $data['table_key'])->delete();

        return response()->json(['pesan' => 'Visibilitas toolbar dikembalikan ke bawaan (semua tampil).']);
    }
}
