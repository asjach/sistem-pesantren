<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Models\DokumenSantri;
use App\Models\DokumenWajibLembaga;
use App\Models\PsbCalonSantri;
use App\Models\User;
use App\Models\WaliSantriRelasi;
use App\Services\RefService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PsbDokumenController extends Controller
{
    use TenantGuard;

    /** POST /api/portal/psb/{calon}/dokumen (orang_tua, cek pemilik + jenis dari ref efektif). */
    public function uploadCalon(Request $request, PsbCalonSantri $calon): JsonResponse
    {
        $this->assertPemilik($request->user(), $calon);

        $data = $request->validate([
            'jenis_dokumen_santri' => ['required', 'string', 'max:50'],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'catatan' => ['nullable', 'string'],
        ]);
        if (! in_array($data['jenis_dokumen_santri'], RefService::kodeAktif('jenis_dokumen_santri', $calon->lembaga_id), true)) {
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
            $this->authorizeLembaga($user, (int) $calon->lembaga_id);
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
    public function verifikasi(Request $request, DokumenSantri $dokumen): JsonResponse
    {
        $dokumen->load(['calon:id,lembaga_id', 'santri:id,lembaga_id']);
        $lembagaId = $dokumen->calon?->lembaga_id ?? $dokumen->santri?->lembaga_id;
        if (! $lembagaId) {
            abort(404, 'Dokumen tidak tertaut ke calon/santri.');
        }
        $this->authorizeLembaga($request->user(), (int) $lembagaId);

        $data = $request->validate([
            'status' => ['required', 'in:menunggu,valid,ditolak'],
            'catatan' => ['nullable', 'string'],
        ]);
        $dokumen->update(['status_verifikasi' => $data['status'], 'catatan' => $data['catatan'] ?? $dokumen->catatan]);

        return response()->json(['pesan' => 'Verifikasi disimpan.', 'data' => $dokumen->fresh()]);
    }

    /** GET /api/admin/dokumen-wajib?lembaga_id= (admin). */
    public function indexWajib(Request $request): JsonResponse
    {
        $data = $request->validate(['lembaga_id' => ['required', 'integer', 'exists:lembaga,id']]);
        $this->authorizeLembaga($request->user(), (int) $data['lembaga_id']);

        return response()->json([
            'pesan' => 'Ketentuan dokumen wajib berhasil dimuat.',
            'data' => DokumenWajibLembaga::where('lembaga_id', $data['lembaga_id'])->latest('id')->get(),
        ]);
    }

    /** POST /api/admin/dokumen-wajib (admin). */
    public function storeWajib(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lembaga_id' => ['required', 'exists:lembaga,id'],
            'jenis_dokumen_santri' => ['required', 'string', 'max:50'],
            'is_wajib' => ['sometimes', 'boolean'],
        ]);
        $this->authorizeLembaga($request->user(), (int) $data['lembaga_id']);

        $row = DokumenWajibLembaga::updateOrCreate(
            ['lembaga_id' => $data['lembaga_id'], 'jenis_dokumen_santri' => $data['jenis_dokumen_santri']],
            ['is_wajib' => $data['is_wajib'] ?? true]
        );

        return response()->json(['pesan' => 'Ketentuan disimpan.', 'data' => $row]);
    }

    /** DELETE /api/admin/dokumen-wajib/{id} (admin). */
    public function destroyWajib(DokumenWajibLembaga $wajib): JsonResponse
    {
        $this->authorizeLembaga(auth()->user(), (int) $wajib->lembaga_id);
        $wajib->delete();

        return response()->json(['pesan' => 'Ketentuan dihapus.']);
    }

    /** Cek pemilik B5 (mirror PsbService::ajukanDaftarUlang). */
    protected function assertPemilik(User $wali, PsbCalonSantri $calon): void
    {
        $milik = ($calon->email_ortu && $calon->email_ortu === $wali->email)
            || ($calon->telp_ortu && $this->normalTelp($calon->telp_ortu) === $this->normalTelp($wali->phone ?? ''))
            || ($calon->santri_asal_id && WaliSantriRelasi::where('user_id', $wali->id)
                ->where('santri_id', $calon->santri_asal_id)
                ->where('is_active', true)
                ->exists());
        if (! $milik) {
            abort(403, 'Calon ini bukan tanggungan akun Anda.');
        }
    }

    protected function normalTelp(?string $telp): string
    {
        $t = preg_replace('/\D/', '', $telp ?? '');

        return preg_replace('/^(0|62)/', '62', $t);
    }
}
