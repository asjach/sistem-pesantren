<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\PsbDokumenIndexWajibRequest;
use App\Http\Requests\PsbDokumenStoreWajibRequest;
use App\Http\Requests\PsbDokumenUploadCalonRequest;
use App\Http\Requests\PsbDokumenVerifikasiRequest;
use App\Models\DokumenSantri;
use App\Models\DokumenWajibLembaga;
use App\Models\PsbCalonSantri;
use App\Models\User;
use App\Services\RefService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PsbDokumenController extends Controller
{
    use TenantGuard;

    /** POST /api/portal/psb/{calon}/dokumen (orang_tua, cek pemilik + jenis dari ref efektif). */
    public function uploadCalon(PsbDokumenUploadCalonRequest $request, PsbCalonSantri $calon): JsonResponse
    {
        $data = $request->validated();
        if (! in_array($data['jenis_dokumen_santri'], RefService::kodeAktif('jenis_dokumen_santri', $calon->jenjang), true)) {
            abort(422, 'Jenis dokumen tidak aktif di lembaga ini.');
        }
        $path = $request->file('file')->store('psb/dokumen', 'local');
        $dok = DokumenSantri::create([
            'psb_calon_santri_id' => $calon->id,
            'jenis_dokumen_santri' => $data['jenis_dokumen_santri'],
            'path_file' => $path,
            'catatan' => $data['catatan'] ?? null,
        ]);
        $dok->file_url = Storage::url($path);

        return response()->json(['pesan' => 'Dokumen diupload.', 'data' => $dok], 201);
    }

    /** GET /api/portal/psb/{calon}/dokumen (orang_tua pemilik / admin tenant). */
    public function listCalon(Request $request, PsbCalonSantri $calon): JsonResponse
    {
        $user = $request->user();
        if ($user->hasAnyRole(['super_admin', 'admin'])) {
            $this->authorizeLembaga($user, $calon->jenjang);
        } else {
            $this->assertPemilik($user, $calon);
        }

        return response()->json([
            'pesan' => 'Dokumen calon berhasil dimuat.',
            'data' => DokumenSantri::where('psb_calon_santri_id', $calon->id)->latest('id')->get(),
        ]);
    }

    /**
     * POST /api/psb/dokumen/{dokumen}/verifikasi (admin, {status: menunggu|valid|ditolak, catatan?}).
     * Deviasi spec snippet: $this->authorize('verifikasi', $dokumen) diganti cek
     * canAccessLembaga — tidak ada DokumenSantriPolicy terdaftar di repo.
     */
    public function verifikasi(PsbDokumenVerifikasiRequest $request, DokumenSantri $dokumen): JsonResponse
    {
        $dokumen->load(['calon:id,jenjang', 'santri:id,jenjang']);
        $lembagaId = $dokumen->calon?->jenjang ?? $dokumen->santri?->jenjang;
        if (! $lembagaId) {
            abort(404, 'Dokumen tidak tertaut ke calon/santri.');
        }
        $this->authorizeLembaga($request->user(), $lembagaId);

        $data = $request->validated();
        $dokumen->update(['status_verifikasi' => $data['status'], 'catatan' => $data['catatan'] ?? $dokumen->catatan]);

        return response()->json(['pesan' => 'Verifikasi disimpan.', 'data' => $dokumen->fresh()]);
    }

    /** GET /api/admin/dokumen-wajib?psb_kegiatan_id=&jenjang= (admin; jenjang opsional). */
    public function indexWajib(PsbDokumenIndexWajibRequest $request): JsonResponse
    {
        $data = $request->validated();

        $query = DokumenWajibLembaga::with('lembaga:jenjang,nama')
            ->where('psb_kegiatan_id', $data['psb_kegiatan_id']);
        $query = $this->scopeLembaga($query, $request->user(), $request);

        return response()->json([
            'pesan' => 'Ketentuan dokumen wajib berhasil dimuat.',
            'data' => $query->latest('id')->get(),
        ]);
    }

    /** POST /api/admin/dokumen-wajib (admin). */
    public function storeWajib(PsbDokumenStoreWajibRequest $request): JsonResponse
    {
        $data = $request->validated();
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $row = DokumenWajibLembaga::updateOrCreate(
            [
                'psb_kegiatan_id' => $data['psb_kegiatan_id'],
                'jenjang' => $data['jenjang'],
                'jenis_dokumen_santri' => $data['jenis_dokumen_santri'],
            ],
            ['is_wajib' => $data['is_wajib'] ?? true]
        );

        return response()->json(['pesan' => 'Ketentuan disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/dokumen-wajib/{id} (admin). */
    public function destroyWajib(DokumenWajibLembaga $wajib): JsonResponse
    {
        $this->authorizeLembaga(auth()->user(), $wajib->jenjang);
        $wajib->delete();

        return response()->json(['pesan' => 'Ketentuan dihapus.']);
    }

    /** Cek pemilik B5 (mirror PsbService::ajukanDaftarUlang). */
    protected function assertPemilik(User $wali, PsbCalonSantri $calon): void
    {
        if (! $calon->milikWali($wali)) {
            abort(403, 'Calon ini bukan tanggungan akun Anda.');
        }
    }
}
