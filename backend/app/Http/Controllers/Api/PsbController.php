<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\PsbSeleksiRequest;
use App\Imports\PsbImport;
use App\Models\PsbCalonSantri;
use App\Services\PsbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\ValidationException as ExcelValidationException;

class PsbController extends Controller
{
    use TenantGuard;

    /** GET /api/psb/antrean-daftar-ulang?status=ajukan_daftar_ulang (scope tenant). */
    public function antrean(Request $request): JsonResponse
    {
        $status = $request->input('status', 'ajukan_daftar_ulang');
        $query = $this->scopeLembaga(PsbCalonSantri::query(), $request->user(), $request)
            ->where('status_pendaftaran', $status)
            ->with(['lembagaTujuan:id,nama,kode', 'gelombang:id,nama'])
            ->latest('id');

        return response()->json([
            'pesan' => 'Antrean berhasil dimuat.',
            'data' => $query->paginate($this->perPage($request)),
        ]);
    }

    /** POST /api/psb/{calon}/verifikasi — baru -> terverifikasi. */
    public function verifikasi(PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeLembaga(auth()->user(), (int) $calon->lembaga_id);

        return response()->json([
            'pesan' => 'Calon terverifikasi.',
            'data' => $service->verifikasi($calon->id, auth()->id()),
        ]);
    }

    /** POST /api/psb/{calon}/seleksi — -> lolos/tidak_lolos (jalur langsung ditolak service). */
    public function seleksi(PsbSeleksiRequest $request, PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeLembaga(auth()->user(), (int) $calon->lembaga_id);
        $data = $request->validated();

        return response()->json([
            'pesan' => 'Hasil seleksi disimpan.',
            'data' => $service->setSeleksi($calon->id, (bool) $data['lolos'], auth()->id(), $data['catatan'] ?? null),
        ]);
    }

    /** POST /api/psb/{calon}/acc-daftar-ulang — INSERT santri (atau reuse santri_asal_id). */
    public function acc(PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeLembaga(auth()->user(), (int) $calon->lembaga_id);

        return response()->json([
            'pesan' => 'Daftar ulang disetujui.',
            'data' => $service->accDaftarUlang($calon->id, auth()->id()),
        ], 201);
    }

    /** POST /api/psb/paket/{grup}/acc — scope khusus paket dienforce service (salah satu lembaga / full). */
    public function accPaket(string $grup, PsbService $service): JsonResponse
    {
        return response()->json([
            'pesan' => 'Paket MI-MD disetujui.',
            'data' => $service->accPaket($grup, auth()->user()),
        ], 201);
    }

    /** POST /api/psb/{calon}/promosi — waiting_list -> baru (kuota dicek service). */
    public function promosi(PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeLembaga(auth()->user(), (int) $calon->lembaga_id);

        return response()->json([
            'pesan' => 'Calon dipromosikan dari waiting list.',
            'data' => $service->promosikanWaiting($calon->id, auth()->id()),
        ]);
    }

    /** POST /api/psb/paket/{grup}/verifikasi — 2 baris grup baru -> terverifikasi bersama. */
    public function verifikasiPaket(string $grup, PsbService $service): JsonResponse
    {
        $baris = PsbCalonSantri::where('paket_grup_id', $grup)->get();
        if ($baris->isEmpty()) {
            abort(404, 'Grup paket tidak ditemukan.');
        }
        $admin = auth()->user();
        $boleh = $admin->hasRole('super_admin') || $admin->isAdminFull()
            || $baris->contains(fn ($b) => $admin->canAccessLembaga((int) $b->lembaga_id));
        if (! $boleh) {
            abort(403, 'Akses ditolak.');
        }

        return response()->json([
            'pesan' => 'Paket terverifikasi.',
            'data' => $service->verifikasiPaket($grup, $admin->id),
        ]);
    }

    /** POST /api/psb/{calon}/tolak — non-paket saja (paket via tolakPaket). */
    public function tolak(Request $request, PsbCalonSantri $calon, PsbService $service): JsonResponse
    {
        $this->authorizeLembaga(auth()->user(), (int) $calon->lembaga_id);
        $data = $request->validate(['catatan' => ['nullable', 'string']]);

        return response()->json([
            'pesan' => 'Calon ditolak.',
            'data' => $service->tolak($calon->id, auth()->id(), $data['catatan'] ?? null),
        ]);
    }

    /** POST /api/psb/paket/{grup}/tolak — atomik 2 baris (service tanpa enforce tenant, cek di sini). */
    public function tolakPaket(Request $request, string $grup, PsbService $service): JsonResponse
    {
        $data = $request->validate(['catatan' => ['nullable', 'string']]);
        $baris = PsbCalonSantri::where('paket_grup_id', $grup)->get();
        if ($baris->isEmpty()) {
            abort(404, 'Grup paket tidak ditemukan.');
        }
        $admin = auth()->user();
        $boleh = $admin->hasRole('super_admin') || $admin->isAdminFull()
            || $baris->contains(fn ($b) => $admin->canAccessLembaga((int) $b->lembaga_id));
        if (! $boleh) {
            abort(403, 'Hanya admin salah satu lembaga paket / admin full yang boleh menolak paket.');
        }

        $service->tolakPaket($grup, auth()->id(), $data['catatan'] ?? null);

        return response()->json(['pesan' => 'Paket ditolak.']);
    }

    /** POST /api/psb/import — Excel kolom inti, NIK required -> create() langsung. */
    public function import(Request $request): JsonResponse
    {
        $data = $request->validate([
            'gelombang_id' => ['required', 'integer', 'exists:psb_gelombang,id'],
            'lembaga_id' => ['required', 'integer', 'exists:lembaga,id'],
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
        ]);
        $this->authorizeLembaga(auth()->user(), (int) $data['lembaga_id']);

        try {
            Excel::import(
                new PsbImport((int) $data['gelombang_id'], (int) $data['lembaga_id']),
                $request->file('file')
            );

            return response()->json(['pesan' => 'Data PSB berhasil diimport.']);
        } catch (ExcelValidationException $e) {
            $errors = [];
            foreach ($e->failures() as $failure) {
                $errors[] = [
                    'row' => $failure->row(),
                    'attribute' => $failure->attribute(),
                    'errors' => $failure->errors(),
                ];
            }

            return response()->json(['pesan' => 'Gagal mengimport beberapa data.', 'errors' => $errors], 422);
        }
    }
}
