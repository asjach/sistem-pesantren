<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ImportSantriRequest;
use App\Imports\SantriLengkapImport;
use App\Models\DokumenSantri;
use App\Models\Santri;
use App\Services\RefService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\ValidationException;

class SantriController extends Controller
{
    use TenantGuard;

    // Daftar santri terskop tenant, dipakai Tab "Santri Aktif" di PySide6
    public function index(Request $request)
    {
        $this->authorize('viewAny', Santri::class);

        $santri = Santri::tenantScope()
            ->with(['lembaga', 'kelas'])
            ->when($request->filled('status_global'), fn ($q) => $q->where('status_global', $request->boolean('status_global')))
            ->latest('id')
            ->paginate(20);

        return response()->json($santri);
    }

    // Upload foto profil santri. Storage: storage/app/santri/foto/* ; DB hanya path di santri.foto_url.
    public function uploadFoto(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('update', $santri);
        $this->authorizeLembaga($request->user(), (int) $santri->lembaga_id);

        $data = $request->validate([
            'foto' => ['required', 'file', 'mimes:jpg,jpeg,png', 'max:2048'],
        ]);

        $path = $request->file('foto')->store('santri/foto', 'local');

        if ($santri->foto_url && Storage::disk('local')->exists($santri->foto_url)) {
            Storage::disk('local')->delete($santri->foto_url);
        }

        $santri->update(['foto_url' => $path]);

        return response()->json([
            'pesan' => 'Foto santri diupload.',
            'data' => $santri->fresh(),
        ], 201);
    }

    // Upload dokumen milik santri (pasca-ACC; pola sama dengan calon di 100).
    // Storage: storage/app/santri/dokumen/* ; verifikasi TU via endpoint yang sama (100).
    public function uploadDokumen(Request $request, Santri $santri)
    {
        $this->authorize('update', $santri);
        $this->authorizeLembaga($request->user(), (int) $santri->lembaga_id);

        $data = $request->validate([
            'jenis_dokumen_santri' => ['required', 'string', 'max:50'],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'catatan' => ['nullable', 'string'],
        ]);
        if (! in_array($data['jenis_dokumen_santri'], RefService::kodeAktif('jenis_dokumen_santri', $santri->lembaga_id), true)) {
            abort(422, 'Jenis dokumen tidak aktif di lembaga ini.');
        }
        $path = $request->file('file')->store('santri/dokumen', 'local');
        $dok = DokumenSantri::create([
            'santri_id' => $santri->id,
            'jenis_dokumen_santri' => $data['jenis_dokumen_santri'],
            'path_file' => $path,
            'catatan' => $data['catatan'] ?? null,
        ]);

        return response()->json(['pesan' => 'Dokumen diupload.', 'data' => $dok], 201);
    }

    // Import PPDB massal via Excel/CSV
    public function importLengkap(ImportSantriRequest $request)
    {
        $this->authorize('create', Santri::class);

        $authUser = auth()->user();

        $lembagaId = $authUser->isAdminFull() || $authUser->hasRole('super_admin')
            ? ($request->lembaga_id ?? ($authUser->lembagaIds()[0] ?? null))
            : ($authUser->lembagaIds()[0] ?? null);

        if (! $lembagaId) {
            return response()->json(['pesan' => 'Lembaga tujuan import tidak ditemukan.'], 422);
        }
        $this->authorizeLembaga($authUser, (int) $lembagaId);

        $import = new SantriLengkapImport((int) $request->tahun_ajaran_id, (int) $lembagaId);

        try {
            Excel::import($import, $request->file('file'));

            if (! empty($import->failures())) {
                $errors = [];
                foreach ($import->failures() as $failure) {
                    $errors[] = [
                        'row'       => $failure->row(),
                        'attribute' => $failure->attribute(),
                        'errors'    => $failure->errors(),
                    ];
                }

                return response()->json([
                    'pesan'  => 'Gagal mengimport beberapa data.',
                    'errors' => $errors,
                ], 422);
            }

            return response()->json(['pesan' => 'Data santri berhasil diimport.']);
        } catch (ValidationException $e) {
            $errors = [];

            foreach ($e->failures() as $failure) {
                $errors[] = [
                    'row'       => $failure->row(),
                    'attribute' => $failure->attribute(),
                    'errors'    => $failure->errors(),
                ];
            }

            return response()->json([
                'pesan'  => 'Gagal mengimport beberapa data.',
                'errors' => $errors,
            ], 422);
        }
    }
}
