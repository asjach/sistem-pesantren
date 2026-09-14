<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ImportSantriRequest;
use App\Imports\SantriLengkapImport;
use App\Models\DokumenSantri;
use App\Models\RiwayatBelajar;
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

    /** PATCH /api/admin/santri/{santri} — edit sel inline (partial update).
     *  Seluruh kolom profil boleh diubah (jalur utama pengisian; import = alternatif).
     *  NIS wajib unik; arsip riwayat aktif ikut disinkronkan saat NIS berubah. */
    public function update(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('update', $santri);

        $aturan = [];
        foreach (Santri::KOLOM_PROFIL as $kolom) {
            $aturan[$kolom] = ['sometimes', 'nullable', 'string', 'max:255'];
        }
        $aturan['nama_lengkap'] = ['sometimes', 'required', 'string', 'max:255'];
        $aturan['alamat'] = ['sometimes', 'nullable', 'string', 'max:500'];
        $aturan['nik'] = $aturan['ayah_nik'] = $aturan['ibu_nik'] = $aturan['wali_nik'] = ['sometimes', 'nullable', 'digits:16'];
        $aturan['no_kk'] = ['sometimes', 'nullable', 'digits:16'];
        $aturan['nisn'] = ['sometimes', 'nullable', 'digits:10'];
        $aturan['nis'] = ['sometimes', 'nullable', 'string', 'max:10'];
        $aturan['jk'] = ['sometimes', 'nullable', 'in:L,P'];
        $aturan['tipe_santri'] = ['sometimes', 'nullable', 'in:asrama,non_asrama'];
        $aturan['anak_ke'] = $aturan['j_saudara'] = ['sometimes', 'nullable', 'integer', 'min:0'];
        $aturan['email_santri'] = ['sometimes', 'nullable', 'email', 'max:255'];
        $aturan['no_hp_santri'] = $aturan['ayah_telp'] = $aturan['ibu_telp'] = $aturan['wali_telp'] = ['sometimes', 'nullable', 'string', 'max:20'];
        $aturan['rt'] = $aturan['rw'] = ['sometimes', 'nullable', 'string', 'max:3'];
        foreach (['tgl_lahir', 'ayah_tgl_lahir', 'ibu_tgl_lahir', 'wali_tgl_lahir', 'tanggal_masuk'] as $k) {
            $aturan[$k] = ['sometimes', 'nullable', 'date'];
        }

        $data = $request->validate($aturan);

        if ($data === []) {
            return response()->json(['pesan' => 'Tidak ada perubahan.', 'data' => $santri->fresh()]);
        }

        if (array_key_exists('nis', $data) && Santri::nisDipakai($data['nis'], $santri->id)) {
            throw \Illuminate\Validation\ValidationException::withMessages(['nis' => 'NIS sudah dipakai santri lain.']);
        }

        $santri->update($data);

        // Mirror NIS ke baris riwayat yang masih aktif (arsip lama dibiarkan historis).
        if (array_key_exists('nis', $data)) {
            RiwayatBelajar::where('santri_id', $santri->id)->where('is_aktif', true)
                ->update(['nis' => $data['nis']]);
        }

        return response()->json(['pesan' => 'Data santri diperbarui.', 'data' => $santri->fresh()]);
    }

    /** Otorisasi per-santri: legacy (lembaga_id NULL) = arsip pusat, boleh semua admin (v1.10);
     *  selain itu tetap tenant ketat per lembaga. */
    private function authorizeSantri(Request $request, Santri $santri): void
    {
        if ($santri->lembaga_id === null) {
            return;
        }
        $this->authorizeLembaga($request->user(), (int) $santri->lembaga_id);
    }

    // Upload foto profil santri. Storage: storage/app/santri/foto/* ; DB hanya path di santri.foto_url.
    public function uploadFoto(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('update', $santri);
        $this->authorizeSantri($request, $santri);

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
        $this->authorizeSantri($request, $santri);

        $data = $request->validate([
            'jenis_dokumen_santri' => ['required', 'string', 'max:50'],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'catatan' => ['nullable', 'string'],
        ]);
        if (! in_array($data['jenis_dokumen_santri'], RefService::kodeAktif('jenis_dokumen_santri', $santri->lembaga_id), true)) {
            abort(422, 'Jenis dokumen tidak aktif di lembaga ini.');
        }
        $path = $request->file('file')->store('santri/dokumen', 'local');
        $dok = DokumenSantri::where('santri_id', $santri->id)
            ->where('jenis_dokumen_santri', $data['jenis_dokumen_santri'])
            ->whereNull('path_file')
            ->latest('id')
            ->first();
        if ($dok) {
            $dok->update([
                'path_file' => $path,
                'catatan' => $data['catatan'] ?? $dok->catatan,
                'tidak_memiliki' => false,
            ]);
        } else {
            $dok = DokumenSantri::create([
                'santri_id' => $santri->id,
                'jenis_dokumen_santri' => $data['jenis_dokumen_santri'],
                'path_file' => $path,
                'catatan' => $data['catatan'] ?? null,
            ]);
        }

        return response()->json(['pesan' => 'Dokumen diupload.', 'data' => $dok], 201);
    }

    // Daftar dokumen santri (checklist termasuk baris tanpa file).
    public function listDokumen(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('view', $santri);
        $this->authorizeSantri($request, $santri);

        return response()->json([
            'pesan' => 'Dokumen santri berhasil dimuat.',
            'data' => DokumenSantri::where('santri_id', $santri->id)->latest('id')->get(),
        ]);
    }

    // Tandai "tidak memiliki dokumen" (tidak menghalangi proses apa pun).
    public function tidakMemiliki(Request $request, Santri $santri, DokumenSantri $dokumen): JsonResponse
    {
        $this->authorize('update', $santri);
        $this->authorizeSantri($request, $santri);

        if ((int) $dokumen->santri_id !== (int) $santri->id) {
            abort(404, 'Dokumen tidak tertaut ke santri ini.');
        }
        $data = $request->validate(['tidak_memiliki' => ['required', 'boolean']]);
        $dokumen->update(['tidak_memiliki' => $data['tidak_memiliki']]);

        return response()->json(['pesan' => 'Status dokumen diperbarui.', 'data' => $dokumen->fresh()]);
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
