<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GrupCustomStoreRequest;
use App\Http\Requests\Admin\GrupCustomUpdateRequest;
use App\Models\GrupSantriCustom;
use Illuminate\Http\Request;

/**
 * Keuangan: grup santri custom — kelompok bentukan manual (mis. peserta
 * ekskul) yang dipakai opsi "Custom" pada dialog Buat Tagihan. Grup tidak
 * terikat lembaga; izin cukup `keuangan.*` di route.
 */
class GrupCustomController extends Controller
{
    private function muat(GrupSantriCustom $grup): GrupSantriCustom
    {
        return $grup->load(['santri:id,nama_lengkap']);
    }

    public function indexGrup()
    {
        return response()->json(
            GrupSantriCustom::with('santri:id,nama_lengkap')->orderBy('nama')->get()
        );
    }

    public function storeGrup(GrupCustomStoreRequest $request)
    {
        $grup = GrupSantriCustom::create($request->validated());

        return response()->json($this->muat($grup), 201);
    }

    public function updateGrup(GrupCustomUpdateRequest $request, GrupSantriCustom $grup)
    {
        $grup->update($request->validated());

        return response()->json($this->muat($grup));
    }

    public function destroyGrup(GrupSantriCustom $grup)
    {
        $grup->delete();

        return response()->json(['pesan' => 'Grup dihapus.']);
    }

    /** Tambah anggota (idempotent: yang sudah masuk dilewati). */
    public function tambahAnggota(Request $request, GrupSantriCustom $grup)
    {
        $data = $request->validate([
            'santri_ids' => 'required|array|min:1',
            'santri_ids.*' => 'integer|exists:santri,id',
        ]);
        $grup->santri()->syncWithoutDetaching($data['santri_ids']);

        return response()->json($this->muat($grup->refresh()));
    }

    /** Keluarkan satu anggota. */
    public function hapusAnggota(GrupSantriCustom $grup, int $santri)
    {
        $grup->santri()->detach($santri);

        return response()->json($this->muat($grup->refresh()));
    }
}
