<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\Lembaga;
use App\Models\PsbBiayaLembaga;
use App\Models\PsbGelombang;
use App\Models\PsbKuotaBiaya;
use App\Services\PsbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

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

        $lembaga = Lembaga::where('is_active', true)
            ->whereIn('kode', array_keys(PsbService::TINGKAT_MASUK_BARU))
            ->orderBy('id')
            ->get(['id', 'kode', 'nama', 'kelompok_psb', 'is_seleksi']);

        $punyaAsrama = $this->lembagaPunyaAsrama();

        $rows = PsbKuotaBiaya::where('gelombang_id', $gelombang->id)
            ->orderBy('lembaga_id')
            ->orderBy('tipe_santri')
            ->get();

        return response()->json([
            'pesan' => 'Kuota & biaya pendaftaran dimuat.',
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
                'lembaga' => $lembaga->map(fn (Lembaga $l) => [
                    'id' => $l->id,
                    'kode' => $l->kode,
                    'nama' => $l->nama,
                    'kelompok_psb' => $l->kelompok_psb,
                    'is_seleksi' => (bool) $l->is_seleksi,
                    'punya_asrama' => in_array($l->id, $punyaAsrama, true),
                ])->values(),
                'rows' => $rows,
            ],
        ]);
    }

    /** POST /api/admin/psb/kuota-biaya — upsert satu baris (gelombang, lembaga, tipe). */
    public function upsertKuota(Request $request): JsonResponse
    {
        $data = $request->validate([
            'gelombang_id' => ['required', 'integer', 'exists:psb_gelombang,id'],
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'tipe_santri' => ['required', 'in:semua,asrama,non_asrama'],
            'kuota' => ['nullable', 'integer', 'min:0'],
            'nominal_pendaftaran' => ['nullable', 'numeric', 'min:0'],
            'nominal_pendaftaran_lanjutan' => ['nullable', 'numeric', 'min:0'],
            'nominal_paket' => ['nullable', 'numeric', 'min:0'],
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
                'kuota', 'nominal_pendaftaran', 'nominal_pendaftaran_lanjutan',
                'nominal_paket', 'membutuhkan_seleksi', 'membutuhkan_pemberkasan',
            ])->toArray()
        );

        return response()->json(['pesan' => 'Kuota & biaya tersimpan.', 'data' => $row->fresh()]);
    }

    /** DELETE /api/admin/psb/kuota-biaya/{kuota} */
    public function destroyKuota(PsbKuotaBiaya $kuota): JsonResponse
    {
        $this->authorizeLembaga(auth()->user(), (int) $kuota->lembaga_id);
        $kuota->delete();

        return response()->json(['pesan' => 'Baris kuota & biaya dihapus.']);
    }

    /** GET /api/admin/psb/biaya-lembaga — biaya masuk & asrama per lembaga (lintas gelombang). */
    public function indexBiaya(Request $request): JsonResponse
    {
        $auth = $request->user();
        $query = PsbBiayaLembaga::with('lembaga:id,nama,kode')->orderBy('lembaga_id');
        if (! ($auth->hasRole('super_admin') || $auth->isAdminFull())) {
            $ids = $auth->lembagaIds();
            $query->whereIn('lembaga_id', $ids ?: [0]);
        }

        return response()->json(['pesan' => 'Biaya lembaga dimuat.', 'data' => $query->get()]);
    }

    /** POST /api/admin/psb/biaya-lembaga — upsert biaya masuk & asrama satu lembaga. */
    public function upsertBiaya(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'biaya_masuk' => ['required', 'numeric', 'min:0'],
            'biaya_asrama' => ['required', 'numeric', 'min:0'],
        ]);
        $this->authorizeLembaga($request->user(), (int) $data['lembaga_id']);

        if ((float) $data['biaya_asrama'] > 0 && ! in_array((int) $data['lembaga_id'], $this->lembagaPunyaAsrama(), true)) {
            throw ValidationException::withMessages([
                'biaya_asrama' => 'Lembaga ini tidak menyediakan asrama. Tambahkan baris kuota tipe asrama terlebih dahulu.',
            ]);
        }

        $row = PsbBiayaLembaga::updateOrCreate(
            ['lembaga_id' => $data['lembaga_id']],
            ['biaya_masuk' => $data['biaya_masuk'], 'biaya_asrama' => $data['biaya_asrama']]
        );

        return response()->json(['pesan' => 'Biaya lembaga tersimpan.', 'data' => $row->fresh('lembaga')]);
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
