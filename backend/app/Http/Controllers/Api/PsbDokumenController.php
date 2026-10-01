<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\PsbDokumenUploadCalonRequest;
use App\Models\DokumenSantri;
use App\Models\PsbCalonSantri;
use App\Models\User;
use App\Services\RefService;
use App\Support\NamaBerkasDokumen;
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
        $berkas = $request->file('file');
        $path = NamaBerkasDokumen::simpan(
            $berkas, 'local', 'santri/dokumen',
            (string) ($calon->nama_lengkap ?? 'calon-'.$calon->id),
            $data['jenis_dokumen_santri'], $data['catatan'] ?? null,
        );
        $dok = DokumenSantri::create([
            'psb_calon_santri_id' => $calon->id,
            'jenis_dokumen_santri' => $data['jenis_dokumen_santri'],
            'nama_file' => basename($path),
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

    /** Cek pemilik B5 (mirror PsbService::ajukanDaftarUlang). */
    protected function assertPemilik(User $wali, PsbCalonSantri $calon): void
    {
        if (! $calon->milikWali($wali)) {
            abort(403, 'Calon ini bukan tanggungan akun Anda.');
        }
    }
}
