<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\PengajuanBiodataSantri;
use App\Models\Santri;
use App\Models\WaliSantriRelasi;
use App\Services\PengajuanBiodataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PengajuanBiodataController extends Controller
{
    use TenantGuard;

    /** POST /api/portal/santri/{santri}/pengajuan-biodata (orang_tua, maks 1 aktif). */
    public function ajukan(Request $request, Santri $santri, PengajuanBiodataService $service): JsonResponse
    {
        $data = $request->validate([
            'diff' => ['required', 'array', 'min:1'],
        ]);
        $milik = WaliSantriRelasi::where('user_id', $request->user()->id)
            ->where('santri_id', $santri->id)
            ->where('is_active', true)
            ->exists();
        if (! $milik) {
            abort(403, 'Santri ini bukan tanggungan akun Anda.');
        }

        return response()->json([
            'pesan' => 'Pengajuan terkirim, menunggu verifikasi admin.',
            'data' => $service->ajukan($santri->id, $request->user()->id, $data['diff'], false),
        ], 201);
    }

    /** DELETE /api/portal/pengajuan-biodata/{id}/batal (pemilik, status diajukan — dicek service). */
    public function batalkan(int $id, PengajuanBiodataService $service): JsonResponse
    {
        $service->batalkan($id, auth()->id());

        return response()->json(['pesan' => 'Pengajuan dibatalkan.']);
    }

    /** GET /api/admin/pengajuan-biodata?status=diajukan (scope tenant lembaga + badge count agregat). */
    public function index(Request $request): JsonResponse
    {
        $status = $request->input('status', 'diajukan');
        $auth = $request->user();

        $base = PengajuanBiodataSantri::query()->whereHas('santri', function ($q) use ($auth, $request) {
            $filterLembaga = $request->filled('lembaga_id') ? $request->integer('lembaga_id') : null;

            if ($auth->bolehPesantren()) {
                if ($filterLembaga !== null) {
                    $q->whereHas('lembagaSantri', fn ($ls) => $ls->where('lembaga_id', $filterLembaga));
                }

                return;
            }

            $ids = $filterLembaga !== null ? [$filterLembaga] : $auth->lembagaIds();
            $q->where(function ($sub) use ($ids, $filterLembaga) {
                $sub->whereHas('lembagaSantri', fn ($ls) => $ls->whereIn('lembaga_id', $ids));
                // Tanpa keanggotaan = arsip pusat → ikut terlihat admin scoped,
                // kecuali saat filter lembaga eksplisit.
                if ($filterLembaga === null) {
                    $sub->orWhereDoesntHave('lembagaSantri');
                }
            });
        });

        $badge = (clone $base)->selectRaw('status, COUNT(*) as jumlah')->groupBy('status')->pluck('jumlah', 'status');

        $list = (clone $base)->where('status', $status)
            ->with(['santri:id,nama_lengkap,nik', 'wali:id,name'])
            ->latest('id')
            ->paginate($this->perPage($request));

        return response()->json([
            'pesan' => 'Antrean pengajuan biodata berhasil dimuat.',
            'data' => $list,
            'badge' => $badge,
        ]);
    }

    /** POST /api/admin/pengajuan-biodata/{id}/setujui (NIK wajib admin full — dienforce service). */
    public function setujui(int $id, PengajuanBiodataService $service): JsonResponse
    {
        $pengajuan = PengajuanBiodataSantri::with('santri:id')->findOrFail($id);
        // Tanpa keanggotaan = arsip pusat/pra-penerimaan → boleh semua admin.
        $lembagaId = $pengajuan->santri->lembagaAktif()->value('lembaga_id')
            ?? $pengajuan->santri->lembagaSantri()->value('lembaga_id');
        if ($lembagaId !== null) {
            $this->authorizeLembaga(auth()->user(), (int) $lembagaId);
        }

        $service->setujui($id, auth()->id(), $this->isFull(auth()->user()));

        return response()->json(['pesan' => 'Pengajuan disetujui.']);
    }

    /** POST /api/admin/pengajuan-biodata/{id}/tolak. */
    public function tolak(Request $request, int $id, PengajuanBiodataService $service): JsonResponse
    {
        $data = $request->validate(['catatan' => ['nullable', 'string']]);
        $pengajuan = PengajuanBiodataSantri::with('santri:id')->findOrFail($id);
        // Tanpa keanggotaan = arsip pusat/pra-penerimaan → boleh semua admin.
        $lembagaId = $pengajuan->santri->lembagaAktif()->value('lembaga_id')
            ?? $pengajuan->santri->lembagaSantri()->value('lembaga_id');
        if ($lembagaId !== null) {
            $this->authorizeLembaga(auth()->user(), (int) $lembagaId);
        }

        $service->tolak($id, auth()->id(), $data['catatan'] ?? null);

        return response()->json(['pesan' => 'Pengajuan ditolak.']);
    }

    protected function isFull($admin): bool
    {
        return $admin->bolehPesantren();
    }
}
