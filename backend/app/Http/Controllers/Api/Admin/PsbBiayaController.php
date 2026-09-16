<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Lembaga;
use App\Models\PsbGelombang;
use App\Models\PsbKuotaBiaya;
use App\Services\PsbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PsbBiayaController extends Controller
{
    use TenantGuard;

    /** GET /api/admin/psb/kuota-biaya?gelombang_id= — isian per lembaga untuk satu gelombang. */
    public function indexKuota(Request $request): JsonResponse
    {
        $data = $request->validate([
            'gelombang_id' => ['required', 'integer', 'exists:psb_gelombang,id'],
        ]);
        $gelombang = PsbGelombang::with('kegiatan:id,nama')->findOrFail($data['gelombang_id']);

        $rows = PsbKuotaBiaya::where('gelombang_id', $gelombang->id)
            ->orderBy('lembaga_id')
            ->orderBy('tipe_santri')
            ->get();

        return response()->json([
            'pesan' => 'Kuota dimuat.',
            'data' => [
                'gelombang' => [
                    'id' => $gelombang->id,
                    'psb_kegiatan_id' => $gelombang->psb_kegiatan_id,
                    'nomor' => $gelombang->nomor,
                    'nama' => $gelombang->nama,
                    'tgl_buka' => $gelombang->tgl_buka?->toDateString(),
                    'tgl_tutup' => $gelombang->tgl_tutup?->toDateString(),
                    'kegiatan' => $gelombang->kegiatan,
                ],
                'lembaga' => $this->lembagaPsb(),
                'rows' => $rows,
            ],
        ]);
    }

    /**
     * GET /api/admin/psb/lembaga — lembaga penerima santri baru.
     *
     * Tidak bergantung gelombang: dipakai pemilih lembaga di luar konteks
     * kuota (mis. ketentuan dokumen) sehingga tetap terisi pada kegiatan yang
     * belum punya gelombang.
     */
    public function indexLembaga(): JsonResponse
    {
        return response()->json([
            'pesan' => 'Lembaga PSB dimuat.',
            'data' => $this->lembagaPsb(),
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    protected function lembagaPsb(): array
    {
        $punyaAsrama = $this->lembagaPunyaAsrama();

        return Lembaga::where('is_active', true)
            ->whereIn('kode', array_keys(PsbService::TINGKAT_MASUK_BARU))
            ->orderBy('id')
            ->get(['id', 'kode', 'nama', 'kelompok_psb', 'is_seleksi'])
            ->map(fn (Lembaga $l) => [
                'id' => $l->id,
                'kode' => $l->kode,
                'nama' => $l->nama,
                'kelompok_psb' => $l->kelompok_psb,
                'is_seleksi' => (bool) $l->is_seleksi,
                'punya_asrama' => in_array($l->id, $punyaAsrama, true),
            ])
            ->values()
            ->all();
    }

    /** POST /api/admin/psb/kuota-biaya — upsert satu baris (gelombang, lembaga, tipe). */
    public function upsertKuota(Request $request): JsonResponse
    {
        $data = $request->validate([
            'gelombang_id' => ['required', 'integer', 'exists:psb_gelombang,id'],
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'tipe_santri' => ['required', 'in:semua,asrama,non_asrama'],
            'kuota' => ['nullable', 'integer', 'min:0'],
            'paket_tersedia' => ['nullable', 'boolean'],
            'membutuhkan_seleksi' => ['nullable', 'boolean'],
            'membutuhkan_pemberkasan' => ['nullable', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), (int) $data['lembaga_id']);

        $row = PsbKuotaBiaya::updateOrCreate(
            [
                'gelombang_id' => $data['gelombang_id'],
                'lembaga_id' => $data['lembaga_id'],
                'tipe_santri' => $data['tipe_santri'],
            ],
            collect($data)->only([
                'kuota', 'paket_tersedia', 'membutuhkan_seleksi', 'membutuhkan_pemberkasan',
            ])->toArray()
        );

        return response()->json(['pesan' => 'Kuota tersimpan.', 'data' => $row->fresh()]);
    }

    /** DELETE /api/admin/psb/kuota-biaya/{kuota} */
    public function destroyKuota(PsbKuotaBiaya $kuota): JsonResponse
    {
        $this->authorizeLembaga(auth()->user(), (int) $kuota->lembaga_id);
        $kuota->delete();

        return response()->json(['pesan' => 'Baris kuota dihapus.']);
    }

    /** Id lembaga yang menyediakan asrama (punya baris kuota tipe asrama/semua). */
    protected function lembagaPunyaAsrama(): array
    {
        return PsbKuotaBiaya::whereIn('tipe_santri', ['asrama', 'semua'])
            ->distinct()
            ->pluck('lembaga_id')
            ->map(fn ($v) => (int) $v)
            ->all();
    }
}
